// ==============================================================================
// Company Brain: OpenAI Provider Adapter (Zero Third-Party SDK Bloat)
// Supports gpt-4o, gpt-4o-mini, o1-mini, o3-mini with native fetch & SSE.
// ==============================================================================

import {
  AIProviderAdapter,
  AIChatMessage,
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  AIError,
  TokenUsage,
} from "../types";
import { BaseAIAdapter } from "./base";
import { calculateTokenCostUsd } from "../config";

export class OpenAIAdapter extends BaseAIAdapter implements AIProviderAdapter {
  readonly id = "openai";
  readonly displayName = "OpenAI";
  readonly defaultModel = "gpt-4o-mini";
  private apiKey: string | null = null;
  private customBaseUrl: string | null = null;

  constructor(apiKey?: string, customBaseUrl?: string) {
    super();
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || null;
    this.customBaseUrl = customBaseUrl || process.env.OPENAI_BASE_URL || null;
  }

  private resolveApiKey(): string {
    const key = this.apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      if (process.env.NODE_ENV === "test") {
        return "mock_test_key_openai_active";
      }
      throw new AIError(
        "Chave de API da OpenAI não configurada. Defina OPENAI_API_KEY ou configure uma chave BYOK.",
        "MISSING_KEY",
        500,
        this.id
      );
    }
    return key;
  }

  private getEndpoint(): string {
    const base = this.customBaseUrl || "https://api.openai.com/v1";
    return `${base.replace(/\/+$/, "")}/chat/completions`;
  }

  private formatMessages(messages: AIChatMessage[], systemInstruction?: string, isReasoning = false): Array<{ role: string; content: string }> {
    const formatted: Array<{ role: string; content: string }> = [];

    if (systemInstruction) {
      formatted.push({
        role: isReasoning ? "developer" : "system",
        content: systemInstruction,
      });
    }

    for (const msg of messages) {
      formatted.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }

    return formatted;
  }

  async generateText(
    messages: AIChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    if (options?.signal?.aborted) {
      throw new AIError("Operação de IA cancelada pelo cliente.", "ABORTED", 499, this.id);
    }

    const apiKey = this.resolveApiKey();
    const model = options?.model || this.defaultModel;
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    const promptText = lastUserMessage?.content || "";

    if (this.isOfflineTestMode(apiKey)) {
      const mock = this.generateOfflineMockText(model, promptText);
      return {
        text: mock.text,
        provider: this.id,
        model,
        usage: mock.usage,
        sources: options?.sources,
        finishReason: "stop",
      };
    }

    const isReasoning = model.startsWith("o1-") || model.startsWith("o3-");
    const payload: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages, options?.systemInstruction, isReasoning),
      stream: false,
    };

    if (isReasoning) {
      if (options?.maxTokens) payload.max_completion_tokens = options.maxTokens;
    } else {
      if (options?.temperature !== undefined) payload.temperature = options.temperature;
      if (options?.maxTokens) payload.max_tokens = options.maxTokens;
    }

    const response = await this.fetchWithRetry(
      this.getEndpoint(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      },
      options?.signal,
      apiKey
    );

    const json = await response.json();
    const candidate = json.choices?.[0];
    const text = candidate?.message?.content || "";

    const promptTokens = json.usage?.prompt_tokens || Math.ceil(promptText.length / 4);
    const completionTokens = json.usage?.completion_tokens || Math.ceil(text.length / 4);
    const cachedPromptTokens = json.usage?.prompt_tokens_details?.cached_tokens || 0;

    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cachedPromptTokens,
      estimatedCostUsd: calculateTokenCostUsd(model, promptTokens, completionTokens, cachedPromptTokens),
    };

    return {
      text,
      provider: this.id,
      model,
      usage,
      sources: options?.sources,
      finishReason: candidate?.finish_reason || "stop",
    };
  }

  async *generateStream(
    messages: AIChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<StreamChunk> {
    const apiKey = this.resolveApiKey();
    const model = options?.model || this.defaultModel;
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    const promptText = lastUserMessage?.content || "";

    if (this.isOfflineTestMode(apiKey)) {
      yield* this.generateOfflineMockStream(model, promptText, options?.signal);
      return;
    }

    const isReasoning = model.startsWith("o1-") || model.startsWith("o3-");
    const payload: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages, options?.systemInstruction, isReasoning),
      stream: true,
      stream_options: { include_usage: true },
    };

    if (isReasoning) {
      if (options?.maxTokens) payload.max_completion_tokens = options.maxTokens;
    } else {
      if (options?.temperature !== undefined) payload.temperature = options.temperature;
      if (options?.maxTokens) payload.max_tokens = options.maxTokens;
    }

    const response = await this.fetchWithRetry(
      this.getEndpoint(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      },
      options?.signal,
      apiKey
    );

    if (!response.body) {
      throw new AIError("Corpo da resposta vazio ao tentar streaming com OpenAI.", "PROVIDER_ERROR", 500, this.id);
    }

    let accumulatedText = "";
    let usage: TokenUsage | undefined;

    for await (const dataStr of this.parseSSEStream(response.body, options?.signal)) {
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content;
        const finishReason = parsed.choices?.[0]?.finish_reason;

        if (delta) {
          accumulatedText += delta;
          yield {
            text: delta,
            done: false,
            provider: this.id,
            model,
          };
        }

        if (parsed.usage) {
          const pt = parsed.usage.prompt_tokens || Math.ceil(promptText.length / 4);
          const ct = parsed.usage.completion_tokens || Math.ceil(accumulatedText.length / 4);
          const cpt = parsed.usage.prompt_tokens_details?.cached_tokens || 0;
          usage = {
            promptTokens: pt,
            completionTokens: ct,
            totalTokens: pt + ct,
            cachedPromptTokens: cpt,
            estimatedCostUsd: calculateTokenCostUsd(model, pt, ct, cpt),
          };
        }

        if (finishReason) {
          if (!usage) {
            const pt = Math.ceil(promptText.length / 4);
            const ct = Math.ceil(accumulatedText.length / 4);
            usage = {
              promptTokens: pt,
              completionTokens: ct,
              totalTokens: pt + ct,
              estimatedCostUsd: calculateTokenCostUsd(model, pt, ct),
            };
          }

          yield {
            text: "",
            done: true,
            usage,
            finishReason: finishReason === "stop" ? "stop" : "length",
            provider: this.id,
            model,
          };
          return;
        }
      } catch {
        // Skip malformed individual chunk
      }
    }

    // Final fallback chunk if loop ends without finishReason
    if (!usage) {
      const pt = Math.ceil(promptText.length / 4);
      const ct = Math.ceil(accumulatedText.length / 4);
      usage = {
        promptTokens: pt,
        completionTokens: ct,
        totalTokens: pt + ct,
        estimatedCostUsd: calculateTokenCostUsd(model, pt, ct),
      };
    }

    yield {
      text: "",
      done: true,
      usage,
      finishReason: "stop",
      provider: this.id,
      model,
    };
  }

  async validateCredential(
    apiKey: string,
    customBaseUrl?: string
  ): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey || apiKey.trim().length < 15) {
      return { valid: false, error: "A chave de API OpenAI deve conter pelo menos 15 caracteres." };
    }

    if (this.isOfflineTestMode(apiKey)) {
      return { valid: true };
    }

    try {
      const base = customBaseUrl || this.customBaseUrl || "https://api.openai.com/v1";
      const res = await fetch(`${base.replace(/\/+$/, "")}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        return { valid: true };
      }

      const body = await res.text();
      return { valid: false, error: this.sanitizeSecret(body, apiKey) };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: `Falha de conexão com a OpenAI: ${this.sanitizeSecret(msg, apiKey)}` };
    }
  }
}
