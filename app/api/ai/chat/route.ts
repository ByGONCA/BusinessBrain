import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { hasPermission } from "@/lib/permissions/resolver";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { getAIProvider, AIChatMessage, AIError, AITaskType, SupportedProviderId, TokenUsage } from "@/lib/ai";
import { AIContextOrchestrator } from "@/lib/ai/context/orchestrator";
import { AIChatService } from "@/lib/ai/chat/service";
import { calculateTokenCostUsd } from "@/lib/ai/config";
import { AIAuthorizationService } from "@/lib/ai/auth/service";
import { GrantAuthorizationParams } from "@/lib/ai/auth/types";
import { AIPageGenerator } from "@/lib/ai/pages/generator";
import { ModelRoutingEngine } from "@/lib/ai/routing/service";
import { AICostLedgerService } from "@/lib/ai/accounting/ledger";
import { decryptAICredential } from "@/lib/crypto/encryption";
import { verifyAIAccessEntitlement } from "@/lib/ai/auth/entitlement-guard";
import { AICreditReservationService } from "@/lib/ai/accounting/reservation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Validate active workspace / organization
    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return new Response(JSON.stringify({ error: "No active workspace selected" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Enforce rate limiting
    const rl = await rateLimit("ai-chat", user.id, RATE_LIMIT_PRESETS.AI_GENERATION);
    if (!rl.success) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment before sending another prompt." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Verify base permission 'ai.chat'
    const isOwnerOrAdmin = activeOrg.role === "owner" || activeOrg.role === "admin";
    const canChat = isOwnerOrAdmin || (await hasPermission(user.id, activeOrg.id, "ai.chat"));

    if (!canChat) {
      return new Response(JSON.stringify({ error: "Forbidden: You do not have permission to use AI Chat." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. Parse request payload
    let body: {
      conversationId?: string;
      prompt?: string;
      model?: string;
      selectionMode?: "auto" | "preferred" | "task";
      taskType?: AITaskType;
      selectedSourceIds?: string[];
      authorizationGrant?: GrantAuthorizationParams;
    };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt cannot be empty" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5.1 Process explicit authorization grant if attached
    if (body.authorizationGrant) {
      try {
        await AIAuthorizationService.grantAuthorization({
          ...body.authorizationGrant,
          organizationId: activeOrg.id,
          userId: user.id,
        });
      } catch (grantErr: any) {
        logger.warn("Failed to apply attached authorization grant", grantErr);
      }
    }

    // 6. Strict Server-Side AI Entitlement Check (Paid Plans or Valid Active Trial Only)
    // COMMERCIAL INVARIANT: Free accounts cannot use AI under any circumstances, even with valid BYOK credentials.
    const entitlement = await verifyAIAccessEntitlement(activeOrg.id);
    if (!entitlement.allowed) {
      return new Response(
        JSON.stringify({
          error: entitlement.message,
          code: entitlement.error,
        }),
        { status: entitlement.status, headers: { "Content-Type": "application/json" } }
      );
    }
    const planTier = entitlement.plan || "starter";

    // 7. Multi-Model Routing Resolution
    const routing = ModelRoutingEngine.resolveModel({
      organizationId: activeOrg.id,
      userId: user.id,
      promptText: prompt,
      taskType: body.taskType,
      selectionMode: body.selectionMode || (body.model ? "preferred" : "auto"),
      userPreferredModelId: body.model,
      organizationTier: planTier as any,
    });

    const targetModel = routing.selectedModel.realModelId;
    const targetProvider: SupportedProviderId = routing.selectedModel.provider;

    // 8. Resolve Credentials (Check Personal BYOK first, then Workspace BYOK)
    let apiKey: string | undefined;
    let customBaseUrl: string | undefined;
    let isByok = false;
    let userCredentialId: string | null = null;

    // Check personal credentials (without filtering status='active' so inactive/revoked keys fail explicitly)
    const { data: userCred } = await supabase
      .from("user_ai_credentials")
      .select("id, encrypted_api_key, custom_base_url, status")
      .eq("user_id", user.id)
      .eq("provider", targetProvider)
      .maybeSingle();

    if (userCred) {
      if (userCred.status !== "active") {
        return new Response(
          JSON.stringify({
            error: `A sua credencial pessoal para o fornecedor '${targetProvider}' encontra-se inativa ou revogada (estado: ${userCred.status}). Atualize a chave em Definições > Chaves de IA.`,
            code: "BYOK_CREDENTIAL_INACTIVE",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      apiKey = decryptAICredential(userCred.encrypted_api_key);
      customBaseUrl = userCred.custom_base_url || undefined;
      isByok = true;
      userCredentialId = userCred.id;
    } else {
      // Check organization credentials
      const { data: orgCred } = await supabase
        .from("organization_ai_credentials")
        .select("id, encrypted_api_key, custom_base_url, status")
        .eq("organization_id", activeOrg.id)
        .eq("provider", targetProvider)
        .maybeSingle();

      if (orgCred) {
        if (orgCred.status !== "active") {
          return new Response(
            JSON.stringify({
              error: `A credencial do workspace para o fornecedor '${targetProvider}' encontra-se inativa ou revogada (estado: ${orgCred.status}).`,
              code: "ORG_CREDENTIAL_INACTIVE",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        apiKey = decryptAICredential(orgCred.encrypted_api_key);
        customBaseUrl = orgCred.custom_base_url || undefined;
        isByok = true;
      }
    }

    // Guard: Never silently substitute an absent BYOK credential with platform credentials
    // If the model is a BYOK-only model or BYOK was explicitly requested, reject if no active BYOK key exists
    if (!routing.selectedModel.isSystemProvided && !isByok) {
      return new Response(
        JSON.stringify({
          error: `O modelo '${routing.selectedModel.displayName}' requer uma chave de API própria (BYOK). Configure uma credencial ativa para '${targetProvider}' em Definições > Chaves de IA.`,
          code: "BYOK_CREDENTIAL_REQUIRED",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 8.1 Two-Phase Credit Reservation & Concurrency Guard
    const estimatedCredits = AICreditReservationService.estimateCredits(prompt);
    const reservation = await AICreditReservationService.reserveCredits({
      organizationId: activeOrg.id,
      userId: user.id,
      conversationId: body.conversationId,
      taskType: body.taskType,
      provider: targetProvider,
      model: targetModel,
      isByok,
      tier: planTier,
      estimatedCredits,
    });

    if (!reservation.success) {
      return new Response(
        JSON.stringify({
          error: reservation.error,
          code: reservation.code,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 9. Manage conversation session
    let conversationId = body.conversationId;
    if (!conversationId) {
      const title = prompt.length > 35 ? prompt.slice(0, 32) + "..." : prompt;
      const newConv = await AIChatService.createConversation(
        activeOrg.id,
        user.id,
        title,
        targetProvider,
        targetModel
      );
      conversationId = newConv.id;
    }

    // 10. Retrieve grounded authorized context with hard scoping
    const contextResult = await AIContextOrchestrator.assembleContext(user.id, activeOrg.id, prompt, {
      selectedSourceIds: body.selectedSourceIds,
      conversationId,
    });

    const encoder = new TextEncoder();

    // 10.1 If an interactive authorization challenge is emitted, return controlled challenge event
    if (contextResult.challenge) {
      if (reservation.reservationId) {
        await AICreditReservationService.releaseReservation(reservation.reservationId);
      }
      const challengeStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "authorization_required",
                conversationId,
                challenge: contextResult.challenge,
              })}\n\n`
            )
          );
          controller.close();
        },
      });

      return new Response(challengeStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // 11. Persist incoming user message
    await AIChatService.appendMessage({
      conversationId,
      organizationId: activeOrg.id,
      userId: user.id,
      role: "user",
      content: prompt,
    });

    // Create placeholder assistant message
    const assistantMessageId = await AIChatService.appendMessage({
      conversationId,
      organizationId: activeOrg.id,
      userId: null,
      role: "assistant",
      content: "",
      sources: contextResult.sources,
    });

    // 12. Load previous messages for conversational continuity
    const history = await AIChatService.getConversationWithMessages(conversationId, activeOrg.id, user.id);
    const formattedMessages: AIChatMessage[] = (history?.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 13. Instantiate Provider Adapter (with BYOK credentials or default)
    let provider = getAIProvider(targetProvider, apiKey ? { apiKey, customBaseUrl } : undefined);
    let selectedModel = targetModel;

    // Detect page generation intent for Phase 3A
    const normalizedPrompt = prompt.toLowerCase();
    const isPageCreationIntent =
      normalizedPrompt.startsWith("cria uma página") ||
      normalizedPrompt.startsWith("cria um documento") ||
      normalizedPrompt.startsWith("gera um relatório") ||
      normalizedPrompt.startsWith("cria um relatório") ||
      normalizedPrompt.includes("cria uma página sobre");

    // 14. Stream response via Server-Sent Events (SSE)
    let accumulatedText = "";
    let isAborted = false;
    let providerReportedUsage: TokenUsage | undefined;

    req.signal.addEventListener("abort", () => {
      isAborted = true;
    });

    const stream = new ReadableStream({
      async start(controller) {
        // First SSE event: conversation metadata, provider, model and verified sources
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "init",
              conversationId,
              messageId: assistantMessageId,
              provider: provider.id,
              model: selectedModel,
              routingReason: routing.routingReason,
              sources: contextResult.sources,
            })}\n\n`
          )
        );

        try {
          let generator: AsyncIterable<any>;

          try {
            generator = provider.generateStream(formattedMessages, {
              model: selectedModel,
              signal: req.signal,
              systemInstruction: contextResult.formattedSystemContext,
              sources: contextResult.sources,
              taskType: body.taskType,
              isByok,
            });
          } catch (initErr: unknown) {
            // Safe fallback if primary model fails initialization
            if (!isByok && routing.fallbackModel && routing.fallbackModel.id !== routing.selectedModel.id && routing.fallbackModel.isSystemProvided) {
              const fallbackProvider = getAIProvider(routing.fallbackModel.provider);
              provider = fallbackProvider;
              selectedModel = routing.fallbackModel.realModelId;
              generator = provider.generateStream(formattedMessages, {
                model: selectedModel,
                signal: req.signal,
                systemInstruction: contextResult.formattedSystemContext,
                sources: contextResult.sources,
              });
            } else {
              throw initErr;
            }
          }

          for await (const chunk of generator) {
            if (isAborted) break;

            if (chunk.usage) {
              providerReportedUsage = chunk.usage;
            }

            if (chunk.text) {
              accumulatedText += chunk.text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "chunk",
                    text: chunk.text,
                    provider: provider.id,
                    model: selectedModel,
                  })}\n\n`
                )
              );
            }
          }

          const hasEmittedContent = accumulatedText.trim().length > 0;
          const durationMs = Date.now() - startTime;

          // Conservative fallback calculation (multilingual Portuguese/Latin text ~3.5 chars/token)
          let actualPromptTokens: number;
          let actualCompletionTokens: number;
          let totalActualTokens: number;

          if (providerReportedUsage && providerReportedUsage.totalTokens > 0) {
            actualPromptTokens = providerReportedUsage.promptTokens;
            actualCompletionTokens = hasEmittedContent ? providerReportedUsage.completionTokens : 0;
            totalActualTokens = actualPromptTokens + actualCompletionTokens;
          } else {
            actualPromptTokens = Math.max(1, Math.ceil(contextResult.formattedSystemContext.length / 3.5));
            actualCompletionTokens = hasEmittedContent ? Math.max(1, Math.ceil(accumulatedText.length / 3.5)) : 0;
            totalActualTokens = actualPromptTokens + actualCompletionTokens;
          }

          const costUsd = calculateTokenCostUsd(selectedModel, actualPromptTokens, actualCompletionTokens);

          if (isAborted) {
            // Priority 1 Fix: Distinguish cancellation before generation vs partial generation
            if (hasEmittedContent) {
              // Generation occurred before client abort: settle consumed tokens to protect platform resources
              if (reservation.reservationId) {
                try {
                  await AICreditReservationService.settleReservation({
                    reservationId: reservation.reservationId,
                    actualTokens: totalActualTokens,
                    isByok,
                    status: "canceled",
                  });
                } catch (settleErr) {
                  logger.error("Failed to settle partial reservation on abort", settleErr);
                }
              }

              await AIChatService.updateMessage(assistantMessageId, {
                content: accumulatedText || "[Interrompido pelo utilizador]",
                tokensCompletion: actualCompletionTokens,
                executionDurationMs: durationMs,
                errorCode: "ABORTED",
              });

              await AICostLedgerService.recordUsage({
                organizationId: activeOrg.id,
                userId: user.id,
                conversationId,
                provider: provider.id,
                model: selectedModel,
                isByok,
                taskType: body.taskType || "general_chat",
                scope: activeOrg.workspace_type === "personal" ? "personal" : "org",
                promptTokens: actualPromptTokens,
                completionTokens: actualCompletionTokens,
                executionDurationMs: durationMs,
                status: "canceled",
              });
            } else {
              // Canceled before any content was emitted: release full reservation
              if (reservation.reservationId) {
                try {
                  await AICreditReservationService.releaseReservation(reservation.reservationId);
                } catch (relErr) {
                  logger.error("Failed to release reservation on pre-generation abort", relErr);
                }
              }

              await AIChatService.updateMessage(assistantMessageId, {
                content: "[Cancelado antes da geração]",
                executionDurationMs: durationMs,
                errorCode: "ABORTED",
              });

              await AICostLedgerService.recordUsage({
                organizationId: activeOrg.id,
                userId: user.id,
                conversationId,
                provider: provider.id,
                model: selectedModel,
                isByok,
                taskType: body.taskType || "general_chat",
                scope: activeOrg.workspace_type === "personal" ? "personal" : "org",
                promptTokens: 0,
                completionTokens: 0,
                executionDurationMs: durationMs,
                status: "canceled",
              });
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  finishReason: "abort",
                  usage: {
                    promptTokens: hasEmittedContent ? actualPromptTokens : 0,
                    completionTokens: actualCompletionTokens,
                    totalTokens: hasEmittedContent ? totalActualTokens : 0,
                    estimatedCostUsd: isByok ? 0 : (hasEmittedContent ? costUsd : 0),
                  },
                })}\n\n`
              )
            );
          } else {
            // Check if page draft preview should be emitted (Phase 3A)
            if (isPageCreationIntent && accumulatedText.length > 20) {
              const draftTitle = prompt
                .replace(/^cria uma página (sobre )?/i, "")
                .replace(/^gera um relatório (sobre )?/i, "")
                .trim()
                .slice(0, 60);

              const draft = AIPageGenerator.createDefaultDraft(
                draftTitle || "Novo Relatório",
                "Rascunho gerado pela IA com base no contexto autorizado da empresa.",
                accumulatedText
              );

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "draft_preview",
                    draft,
                  })}\n\n`
                )
              );
            }

            // Settle credit reservation based on actual tokens
            if (reservation.reservationId) {
              await AICreditReservationService.settleReservation({
                reservationId: reservation.reservationId,
                actualTokens: actualPromptTokens + actualCompletionTokens,
                isByok,
                status: "success",
              });
            }

            // Update message as completed successfully
            await AIChatService.updateMessage(assistantMessageId, {
              content: accumulatedText,
              tokensCompletion: actualCompletionTokens,
              executionDurationMs: durationMs,
            });

            await AICostLedgerService.recordUsage({
              organizationId: activeOrg.id,
              userId: user.id,
              conversationId,
              provider: provider.id,
              model: selectedModel,
              isByok,
              taskType: body.taskType || "general_chat",
              scope: activeOrg.workspace_type === "personal" ? "personal" : "org",
              promptTokens: actualPromptTokens,
              completionTokens: actualCompletionTokens,
              executionDurationMs: durationMs,
              status: "success",
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  finishReason: "stop",
                  provider: provider.id,
                  model: selectedModel,
                  executionDurationMs: durationMs,
                  usage: {
                    promptTokens: actualPromptTokens,
                    completionTokens: actualCompletionTokens,
                    totalTokens: actualPromptTokens + actualCompletionTokens,
                    estimatedCostUsd: isByok ? 0 : costUsd,
                  },
                })}\n\n`
              )
            );
          }
        } catch (streamErr: unknown) {
          const durationMs = Date.now() - startTime;
          const errCode = streamErr instanceof AIError ? streamErr.code : "PROVIDER_ERROR";
          const errMsg = streamErr instanceof Error ? streamErr.message : "Erro na geração de IA.";
          const hasEmittedContent = accumulatedText.trim().length > 0;

          logger.error("AI chat streaming error", streamErr, { orgId: activeOrg.id, errCode });

          const isAbortError = errCode === "ABORTED" || isAborted || req.signal.aborted;

          if (isAbortError && hasEmittedContent) {
            const fallbackPrompt = Math.max(1, Math.ceil(contextResult.formattedSystemContext.length / 3.5));
            const fallbackCompletion = Math.max(1, Math.ceil(accumulatedText.length / 3.5));
            const settledPromptTokens = providerReportedUsage?.promptTokens || fallbackPrompt;
            const settledCompletionTokens = providerReportedUsage?.completionTokens || fallbackCompletion;
            const settledTotalTokens = settledPromptTokens + settledCompletionTokens;

            if (reservation.reservationId) {
              try {
                await AICreditReservationService.settleReservation({
                  reservationId: reservation.reservationId,
                  actualTokens: settledTotalTokens,
                  isByok,
                  status: "canceled",
                });
              } catch (settleErr) {
                logger.error("Failed to settle reservation on aborted catch", settleErr);
              }
            }

            await AIChatService.updateMessage(assistantMessageId, {
              content: accumulatedText ? `${accumulatedText}\n\n[Interrompido pelo utilizador]` : "[Interrompido pelo utilizador]",
              tokensCompletion: settledCompletionTokens,
              executionDurationMs: durationMs,
              errorCode: "ABORTED",
            });

            await AICostLedgerService.recordUsage({
              organizationId: activeOrg.id,
              userId: user.id,
              conversationId,
              provider: provider.id,
              model: selectedModel,
              isByok,
              taskType: body.taskType || "general_chat",
              scope: activeOrg.workspace_type === "personal" ? "personal" : "org",
              promptTokens: settledPromptTokens,
              completionTokens: settledCompletionTokens,
              executionDurationMs: durationMs,
              status: "canceled",
              errorDetails: { error: errMsg, code: "ABORTED" },
            });
          } else {
            if (reservation.reservationId) {
              try {
                await AICreditReservationService.releaseReservation(reservation.reservationId);
              } catch (relErr) {
                logger.error("Failed to release reservation on catch", relErr);
              }
            }

            await AIChatService.updateMessage(assistantMessageId, {
              content: accumulatedText ? `${accumulatedText}\n\n[Erro na ligação: ${errMsg}]` : `[Erro: ${errMsg}]`,
              executionDurationMs: durationMs,
              errorCode: errCode,
            });

            await AICostLedgerService.recordUsage({
              organizationId: activeOrg.id,
              userId: user.id,
              conversationId,
              provider: provider.id,
              model: selectedModel,
              isByok,
              taskType: body.taskType || "general_chat",
              scope: activeOrg.workspace_type === "personal" ? "personal" : "org",
              promptTokens: 0,
              completionTokens: 0,
              executionDurationMs: durationMs,
              status: isAbortError ? "canceled" : "failed",
              errorDetails: { error: errMsg, code: errCode },
            });
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: errMsg,
                code: errCode,
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    logger.error("Unexpected error in /api/ai/chat", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
