// ==============================================================================
// Company Brain: Anthropic Claude Provider Adapter (Zero Third-Party SDK Bloat)
// Supports claude-3-5-sonnet, claude-3-5-haiku with native fetch & SSE.
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

export class AnthropicAdapter extends BaseAIAdapter implements AIProviderAdapter {
  readonly id = "anthropic";
  readonly displayName = "Anthropic Claude";
  readonly defaultModel = "claude-3-5-sonnet-20241022";
  private apiKey: string | null = null;
  private customBaseUrl: string | null = null;

  constructor(apiKey?: string, customBaseUrl?: string) {
    super();
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || null;
    this.customBaseUrl = customBaseUrl || process.env.ANTHROPIC_BASE_URL || null;
  }

  private resolveApiKey(): string {
    const key = this.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      if (process.env.NODE_ENV === "test") {
        return "mock_test_key_anthropic_active";
      }
      throw new AIError(
        "Chave de API da Anthropic não configurada. Defina ANTHROPIC_API_KEY ou configure uma chave BYOK.",
        "MISSING_KEY",
        500,
        this.id
      );
    }
    return key;
  }

  private getEndpoint(): string {
    const base = this.customBaseUrl || "https://api.anthropic.com/v1";
    return `${base.replace(/\/+$/, "")}/messages`;
  }

  private formatMessages(messages: AIChatMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
    const formatted: Array<{ role: "user" | "assistant"; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === "system") continue; // system instruction passed at root level
      formatted.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }

    if (formatted.length === 0) {
      formatted.push({ role: "user", content: "Olá" });
    }

    return formatted;
  }

  async generateText(
    messages: AIChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
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

    const payload: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages),
      max_tokens: options?.maxTokens || 4096,
      stream: false,
    };

    if (options?.systemInstruction) {
      payload.system = options.systemInstruction;
    }
    if (options?.temperature !== undefined) {
      payload.temperature = options.temperature;
    }

    const response = await this.fetchWithRetry(
      this.getEndpoint(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      },
      options?.signal,
      apiKey
    );

    const json = await response.json();
    const text = json.content?.[0]?.text || "";

    const promptTokens = json.usage?.input_tokens || Math.ceil(promptText.length / 4);
    const completionTokens = json.usage?.output_tokens || Math.ceil(text.length / 4);
    const cachedPromptTokens = json.usage?.cache_read_input_tokens || 0;

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
      finishReason: json.stop_reason === "end_turn" ? "stop" : "length",
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

    const payload: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages),
      max_tokens: options?.maxTokens || 4096,
      stream: true,
    };

    if (options?.systemInstruction) {
      payload.system = options.systemInstruction;
    }
    if (options?.temperature !== undefined) {
      payload.temperature = options.temperature;
    }

    const response = await this.fetchWithRetry(
      this.getEndpoint(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      },
      options?.signal,
      apiKey
    );

    if (!response.body) {
      throw new AIError("Corpo da resposta vazio ao tentar streaming com Anthropic.", "PROVIDER_ERROR", 500, this.id);
    }

    let accumulatedText = "";
    let promptTokens = Math.ceil(promptText.length / 4);
    let completionTokens = 0;
    let cachedPromptTokens = 0;

    for await (const dataStr of this.parseSSEStream(response.body, options?.signal)) {
      try {
        const parsed = JSON.parse(dataStr);

        // Anthropic event types
        if (parsed.type === "message_start" && parsed.message?.usage) {
          promptTokens = parsed.message.usage.input_tokens || promptTokens;
          cachedPromptTokens = parsed.message.usage.cache_read_input_tokens || 0;
        }

        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          accumulatedText += parsed.delta.text;
          yield {
            text: parsed.delta.text,
            done: false,
            provider: this.id,
            model,
          };
        }

        if (parsed.type === "message_delta" && parsed.usage) {
          completionTokens = parsed.usage.output_tokens || Math.ceil(accumulatedText.length / 4);
        }

        if (parsed.type === "message_stop") {
          const ct = completionTokens || Math.ceil(accumulatedText.length / 4);
          const usage: TokenUsage = {
            promptTokens,
            completionTokens: ct,
            totalTokens: promptTokens + ct,
            cachedPromptTokens,
            estimatedCostUsd: calculateTokenCostUsd(model, promptTokens, ct, cachedPromptTokens),
          };

          yield {
            text: "",
            done: true,
            usage,
            finishReason: "stop",
            provider: this.id,
            model,
          };
          return;
        }
      } catch {
        // Skip malformed chunk
      }
    }

    // Fallback completion
    const ct = completionTokens || Math.ceil(accumulatedText.length / 4);
    const usage: TokenUsage = {
      promptTokens,
      completionTokens: ct,
      totalTokens: promptTokens + ct,
      cachedPromptTokens,
      estimatedCostUsd: calculateTokenCostUsd(model, promptTokens, ct, cachedPromptTokens),
    };

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
      return { valid: false, error: "A chave de API da Anthropic deve conter pelo menos 15 caracteres." };
    }

    if (this.isOfflineTestMode(apiKey)) {
      return { valid: true };
    }

    try {
      const base = customBaseUrl || this.customBaseUrl || "https://api.anthropic.com/v1";
      const res = await fetch(`${base.replace(/\/+$/, "")}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok || res.status === 400) {
        // If 200 or 400 (e.g. invalid max_tokens), the key is authenticated!
        return { valid: true };
      }

      const body = await res.text();
      return { valid: false, error: this.sanitizeSecret(body, apiKey) };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: `Falha de conexão com a Anthropic: ${this.sanitizeSecret(msg, apiKey)}` };
    }
  }
}
