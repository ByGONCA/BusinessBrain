import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getAICreditQuota } from "@/lib/ai/config";
import { logger } from "@/lib/security/logger";

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  error?: string;
  code?: "QUOTA_EXHAUSTED" | "CONCURRENCY_LIMIT_REACHED" | "RESERVATION_FAILED";
  usedCredits?: number;
  reservedCredits?: number;
  quota?: number;
}

export class AICreditReservationService {
  /**
   * Estimates conservative credits required for a task (1 credit = 1,000 tokens).
   */
  static estimateCredits(promptText: string, maxTokens = 2000): number {
    const estimatedPromptTokens = Math.ceil((promptText || "").length / 3.5);
    const totalEstimatedTokens = estimatedPromptTokens + maxTokens;
    return Math.max(1, Math.ceil(totalEstimatedTokens / 1000));
  }

  /**
   * Atomically reserves credits before calling an AI provider.
   * If BYOK is true, reserves 0 credits (cost $0.00), but tracks concurrency.
   */
  static async reserveCredits(params: {
    organizationId: string;
    userId: string;
    conversationId?: string;
    taskType?: string;
    provider: string;
    model: string;
    isByok: boolean;
    tier: string;
    quota?: number;
    estimatedCredits?: number;
    clientOverride?: SupabaseClient;
  }): Promise<ReservationResult> {
    const supabase = params.clientOverride || (await createClient());
    const quota = params.quota ?? getAICreditQuota(params.tier);
    const estimatedCredits = params.estimatedCredits ?? 2;
    const taskType = params.taskType || "general_chat";

    // 1. Attempt PostgreSQL RPC atomic reservation
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "reserve_ai_credits_atomic",
        {
          p_org_id: params.organizationId,
          p_user_id: params.userId,
          p_conversation_id: params.conversationId || null,
          p_task_type: taskType,
          p_provider: params.provider,
          p_model: params.model,
          p_is_byok: params.isByok,
          p_estimated_credits: estimatedCredits,
          p_quota: quota,
        }
      );

      if (rpcError) {
        logger.error("Atomic AI reservation RPC error", rpcError);
        if (process.env.NODE_ENV === "production") {
          return {
            success: false,
            error: "Falha na reserva atómica de créditos de IA. Operação abortada por segurança.",
            code: "RESERVATION_FAILED",
          };
        }
      }

      if (!rpcError && rpcData && rpcData.length > 0) {
        const row = rpcData[0];
        if (!row.allowed) {
          return {
            success: false,
            error:
              row.error_code === "CONCURRENCY_LIMIT_REACHED"
                ? "Limite de pedidos simultâneos de IA atingido (máx. 10). Aguarde a conclusão dos pedidos em curso."
                : `Quota mensal de créditos de IA atingida (${row.used_credits} / ${row.quota} créditos utilizados ou reservados). Atualize o seu plano para continuar.`,
            code: (row.error_code as any) || "QUOTA_EXHAUSTED",
            usedCredits: row.used_credits,
            reservedCredits: row.reserved_credits,
            quota: row.quota,
          };
        }

        return {
          success: true,
          reservationId: row.reservation_id,
          usedCredits: row.used_credits,
          reservedCredits: row.reserved_credits,
          quota: row.quota,
        };
      }

      if (process.env.NODE_ENV === "production") {
        return {
          success: false,
          error: "Falha na reserva atómica de créditos de IA. Operação abortada por segurança.",
          code: "RESERVATION_FAILED",
        };
      }
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        logger.error("Exception in production atomic AI reservation", err);
        return {
          success: false,
          error: "Falha na reserva atómica de créditos de IA. Operação abortada por segurança.",
          code: "RESERVATION_FAILED",
        };
      }
    }

    // 2. Direct transactional fallback for test harness & standard client
    return this.reserveCreditsFallback(supabase, {
      ...params,
      quota,
      estimatedCredits,
      taskType,
    });
  }

  /**
   * Resilient query-level reservation fallback when RPC is unavailable.
   */
  private static async reserveCreditsFallback(
    supabase: SupabaseClient,
    params: {
      organizationId: string;
      userId: string;
      conversationId?: string;
      taskType: string;
      provider: string;
      model: string;
      isByok: boolean;
      quota: number;
      estimatedCredits: number;
    }
  ): Promise<ReservationResult> {
    const nowIso = new Date().toISOString();

    // Expire stale reservations
    await supabase
      .from("ai_credit_reservations")
      .update({ status: "expired" })
      .eq("organization_id", params.organizationId)
      .eq("status", "reserved")
      .lt("expires_at", nowIso);

    // Concurrency check (max 10 in-flight per org)
    const { count: concurrentCount } = await supabase
      .from("ai_credit_reservations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", params.organizationId)
      .eq("status", "reserved")
      .gte("expires_at", nowIso);

    if ((concurrentCount || 0) >= 10) {
      return {
        success: false,
        error: "Limite de pedidos simultâneos de IA atingido (máx. 10). Aguarde a conclusão dos pedidos em curso.",
        code: "CONCURRENCY_LIMIT_REACHED",
        quota: params.quota,
      };
    }

    // If BYOK: reserve $0.00 platform credits, record concurrency
    if (params.isByok) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { data: inserted, error: insErr } = await supabase
        .from("ai_credit_reservations")
        .insert({
          organization_id: params.organizationId,
          user_id: params.userId,
          conversation_id: params.conversationId || null,
          task_type: params.taskType,
          provider: params.provider,
          model: params.model,
          is_byok: true,
          reserved_credits: 0,
          status: "reserved",
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (insErr || !inserted) {
        return { success: false, error: "Failed to reserve BYOK concurrency slot", code: "RESERVATION_FAILED" };
      }

      return {
        success: true,
        reservationId: inserted.id,
        usedCredits: 0,
        reservedCredits: 0,
        quota: params.quota,
      };
    }

    // Platform key: calculate used tokens from beginning of month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: ledgerData } = await supabase
      .from("ai_usage_ledger")
      .select("prompt_tokens, completion_tokens")
      .eq("organization_id", params.organizationId)
      .in("status", ["success", "canceled"])
      .eq("is_byok", false)
      .gte("created_at", startOfMonth);

    let usedTokens = 0;
    if (ledgerData) {
      for (const row of ledgerData) {
        usedTokens += (row.prompt_tokens || 0) + (row.completion_tokens || 0);
      }
    }
    const usedCredits = Math.floor(usedTokens / 1000);

    // Sum active reserved credits
    const { data: reservedData } = await supabase
      .from("ai_credit_reservations")
      .select("reserved_credits")
      .eq("organization_id", params.organizationId)
      .eq("status", "reserved")
      .eq("is_byok", false)
      .gte("expires_at", nowIso);

    let activeReservedCredits = 0;
    if (reservedData) {
      for (const row of reservedData) {
        activeReservedCredits += row.reserved_credits || 0;
      }
    }

    if (usedCredits + activeReservedCredits + params.estimatedCredits > params.quota) {
      return {
        success: false,
        error: `Quota mensal de créditos de IA atingida (${usedCredits} utilizados + ${activeReservedCredits} em curso / ${params.quota} limite). Atualize o seu plano para continuar.`,
        code: "QUOTA_EXHAUSTED",
        usedCredits,
        reservedCredits: activeReservedCredits,
        quota: params.quota,
      };
    }

    // Insert active reservation
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data: inserted, error: insErr } = await supabase
      .from("ai_credit_reservations")
      .insert({
        organization_id: params.organizationId,
        user_id: params.userId,
        conversation_id: params.conversationId || null,
        task_type: params.taskType,
        provider: params.provider,
        model: params.model,
        is_byok: false,
        reserved_credits: params.estimatedCredits,
        status: "reserved",
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      logger.error("Failed to insert AI reservation", insErr);
      return { success: false, error: "Failed to allocate reservation slot", code: "RESERVATION_FAILED" };
    }

    return {
      success: true,
      reservationId: inserted.id,
      usedCredits,
      reservedCredits: activeReservedCredits + params.estimatedCredits,
      quota: params.quota,
    };
  }

  /**
   * Settles a reservation based on actual consumed tokens.
   * State Machine Invariant: ONLY a reservation with status='reserved' can be settled.
   */
  static async settleReservation(params: {
    reservationId: string;
    actualTokens: number;
    isByok: boolean;
    status?: "success" | "failed" | "canceled";
    clientOverride?: SupabaseClient;
  }): Promise<{ success: boolean; settledCredits: number; error?: string }> {
    const supabase = params.clientOverride || (await createClient());
    const settledCredits = params.isByok ? 0 : Math.max(1, Math.ceil(params.actualTokens / 1000));

    // 1. Attempt PostgreSQL RPC atomic settlement
    try {
      const { data, error } = await supabase.rpc("settle_ai_credit_reservation_atomic", {
        p_reservation_id: params.reservationId,
        p_actual_tokens: params.actualTokens,
        p_is_byok: params.isByok,
        p_status: params.status || "settled",
      });
      if (!error && data && data.length > 0) {
        if (!data[0].success) {
          logger.warn("State conflict settling AI reservation via RPC", { id: params.reservationId, error: data[0].error_code });
          return { success: false, settledCredits: 0, error: "STATE_CONFLICT: Reserva não se encontra em estado 'reserved'." };
        }
        return { success: true, settledCredits: data[0].settled_credits };
      }
    } catch {
      // RPC fallback
    }

    // 2. Direct conditional update strictly scoped to status = 'reserved'
    const { data: updated, error: updErr } = await supabase
      .from("ai_credit_reservations")
      .update({
        settled_credits: settledCredits,
        status: "settled",
        settled_at: new Date().toISOString(),
      })
      .eq("id", params.reservationId)
      .eq("status", "reserved")
      .select("id")
      .maybeSingle();

    if (updErr || !updated) {
      logger.warn("State conflict settling AI reservation: record was not in reserved state", { id: params.reservationId });
      return { success: false, settledCredits: 0, error: "STATE_CONFLICT: Reserva não se encontra em estado 'reserved'." };
    }

    return { success: true, settledCredits };
  }

  /**
   * Releases an unconsumed reservation (e.g. stream aborted before output or error before provider call).
   * State Machine Invariant: ONLY a reservation with status='reserved' can be released.
   */
  static async releaseReservation(
    reservationId: string,
    clientOverride?: SupabaseClient
  ): Promise<{ success: boolean; error?: string }> {
    const client = await paramsClient(clientOverride);

    // 1. Attempt PostgreSQL RPC atomic release
    try {
      const { data, error } = await client.rpc("release_ai_credit_reservation_atomic", {
        p_reservation_id: reservationId,
      });
      if (!error && data && data.length > 0) {
        if (!data[0].success) {
          logger.warn("State conflict releasing AI reservation via RPC", { id: reservationId, error: data[0].error_code });
          return { success: false, error: "STATE_CONFLICT: Reserva não se encontra em estado 'reserved'." };
        }
        return { success: true };
      }
    } catch {
      // RPC fallback
    }

    // 2. Direct conditional update strictly scoped to status = 'reserved'
    const { data: updated, error: updErr } = await client
      .from("ai_credit_reservations")
      .update({
        settled_credits: 0,
        status: "released",
        settled_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .eq("status", "reserved")
      .select("id")
      .maybeSingle();

    if (updErr || !updated) {
      logger.warn("State conflict releasing AI reservation: record was not in reserved state", { id: reservationId });
      return { success: false, error: "STATE_CONFLICT: Reserva não se encontra em estado 'reserved'." };
    }

    return { success: true };
  }
}

async function paramsClient(override?: SupabaseClient): Promise<SupabaseClient> {
  return override || (await createClient());
}
