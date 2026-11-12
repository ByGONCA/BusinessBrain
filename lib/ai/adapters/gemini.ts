import {
  AIProviderAdapter,
  AIChatMessage,
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  AIError,
  TokenUsage,
} from "../types";
import { DEFAULT_GEMINI_MODEL, calculateTokenCostUsd } from "../config";
import { BaseAIAdapter } from "./base";

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
      role?: string;
    };
    finishReason?: string;
  }>;
  usageMetadata?: GeminiUsageMetadata;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export class GeminiAdapter extends BaseAIAdapter implements AIProviderAdapter {
  readonly id = "gemini";
  readonly displayName = "Google Gemini";
  readonly defaultModel = DEFAULT_GEMINI_MODEL;
  private apiKey: string | null = null;
  private customBaseUrl: string | null = null;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(apiKey?: string, customBaseUrl?: string) {
    super();
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || null;
    this.customBaseUrl = customBaseUrl || process.env.GEMINI_BASE_URL || null;
    if (this.customBaseUrl) {
      this.baseUrl = this.customBaseUrl.replace(/\/+$/, "");
    }
  }

  private resolveApiKey(): string {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      if (process.env.NODE_ENV === "test") {
        return "mock_test_key_gemini_active";
      }
      throw new AIError(
        "Gemini API key is not configured. Missing GEMINI_API_KEY environment variable.",
        "MISSING_KEY",
        500,
        this.id
      );
    }
    return key;
  }

  /**
   * Maps canonical AIChatMessage[] to Gemini's expected contents format.
   * System messages are separated into systemInstruction.
   */
  private formatPayload(messages: AIChatMessage[], options?: ChatCompletionOptions) {
    const geminiContents: GeminiContent[] = [];
    const systemParts: GeminiPart[] = [];

    if (options?.systemInstruction) {
      systemParts.push({ text: options.systemInstruction });
    }

    for (const msg of messages) {
      if (msg.role === "system") {
        systemParts.push({ text: msg.content });
      } else {
        geminiContents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Gemini requires at least one content entry
    if (geminiContents.length === 0) {
      geminiContents.push({
        role: "user",
        parts: [{ text: "Hello" }],
      });
    }

    const payload: Record<string, unknown> = {
      contents: geminiContents,
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.maxTokens ?? 4096,
      },
    };

    if (systemParts.length > 0) {
      payload.systemInstruction = {
        parts: systemParts,
      };
    }

    return payload;
  }

  /**
   * Generates a non-streaming completion.
   */
  async generateText(
    messages: AIChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const apiKey = this.resolveApiKey();
    const model = options?.model || this.defaultModel;

    // Offline / Test mock bypass when testing without live internet
    if (this.isOfflineTestMode(apiKey)) {
      return this.generateMockResponse(messages, model, options);
    }

    const url = `${this.baseUrl}/models/${model}:generateContent`;
    const payload = this.formatPayload(messages, options);

    const response = await this.fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      },
      options?.signal,
      apiKey
    );

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text).join("") || "";
    const promptTokens = data.usageMetadata?.promptTokenCount || 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = data.usageMetadata?.totalTokenCount || promptTokens + completionTokens;

    return {
      text,
      provider: this.id,
      model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: calculateTokenCostUsd(model, promptTokens, completionTokens),
      },
      sources: options?.sources,
      finishReason: candidate?.finishReason === "STOP" ? "stop" : "length",
    };
  }

  /**
   * Generates a streaming text completion using Server-Sent Events (SSE).
   */
  async *generateStream(
    messages: AIChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<StreamChunk> {
    const apiKey = this.resolveApiKey();
    const model = options?.model || this.defaultModel;

    // Offline / Test mock bypass when testing without live internet
    if (this.isOfflineTestMode(apiKey)) {
      yield* this.generateMockStream(messages, model, options);
      return;
    }

    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse`;
    const payload = this.formatPayload(messages, options);

    const response = await this.fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      },
      options?.signal,
      apiKey
    );

    if (!response.body) {
      throw new AIError("Gemini streaming response body is null", "PROVIDER_ERROR", 502, this.id);
    }

    let lastUsage: TokenUsage | undefined;

    for await (const jsonStr of this.parseSSEStream(response.body, options?.signal)) {
      try {
        const parsed = JSON.parse(jsonStr) as GeminiGenerateContentResponse;
        if (parsed.usageMetadata) {
          const pt = parsed.usageMetadata.promptTokenCount || 0;
          const ct = parsed.usageMetadata.candidatesTokenCount || 0;
          lastUsage = {
            promptTokens: pt,
            completionTokens: ct,
            totalTokens: parsed.usageMetadata.totalTokenCount || pt + ct,
            estimatedCostUsd: calculateTokenCostUsd(model, pt, ct),
          };
        }

        const textChunk = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
        if (textChunk) {
          yield {
            text: textChunk,
            done: false,
            usage: lastUsage,
            provider: this.id,
            model,
          };
        }
      } catch {
        // Ignore malformed partial chunks in SSE stream
      }
    }

    yield {
      text: "",
      done: true,
      finishReason: "stop",
      usage: lastUsage,
      provider: this.id,
      model,
    };
  }

  /**
   * Validates Gemini API key format and performs a lightweight capability check.
   */
  async validateCredential(apiKey: string, customBaseUrl?: string): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey || apiKey.trim().length < 20) {
      return { valid: false, error: "API key format is invalid or too short." };
    }

    if (this.isOfflineTestMode(apiKey)) {
      return { valid: true };
    }

    try {
      const base = customBaseUrl || this.customBaseUrl || this.baseUrl;
      const url = `${base.replace(/\/+$/, "")}/models`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey.trim(),
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        return { valid: true };
      }

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return { valid: false, error: "Google rejected the API key (Invalid or unauthorized)." };
      }

      const body = await res.text();
      return { valid: false, error: `Google API responded with HTTP ${res.status}: ${this.sanitizeSecret(body, apiKey)}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error verifying API key.";
      return { valid: false, error: this.sanitizeSecret(msg, apiKey) };
    }
  }

  /**
   * Deterministic mock response for offline development and CI testing.
   */
  private generateMockResponse(
    messages: AIChatMessage[],
    model: string,
    options?: ChatCompletionOptions
  ): ChatCompletionResponse {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    let replyText = `[Simulação KogSync ${model}] Informação processada com sucesso.`;

    if (options?.sources && options.sources.length > 0) {
      replyText += ` Com base no documento "${options.sources[0].title}", confirmo a seguinte resposta: ${lastUserMessage}`;
    }

    return {
      text: replyText,
      provider: this.id,
      model,
      usage: {
        promptTokens: 120,
        completionTokens: 45,
        totalTokens: 165,
        estimatedCostUsd: calculateTokenCostUsd(model, 120, 45),
      },
      sources: options?.sources,
      finishReason: "stop",
    };
  }

  private async *generateMockStream(
    messages: AIChatMessage[],
    model: string,
    options?: ChatCompletionOptions
  ): AsyncIterable<StreamChunk> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const words = [
      `[Simulação`,
      `Gemini]`,
      `Análise`,
      `empresarial:`,
      `a`,
      `respeito`,
      `de`,
      `"${lastUserMessage.slice(0, 30)}...",`,
      `os`,
      `dados`,
      `confirmam`,
      `conformidade`,
      `operacional.`,
    ];

    for (const word of words) {
      if (options?.signal?.aborted) {
        throw new AIError("Stream generation was aborted by client", "ABORTED", 499, this.id);
      }
      yield { text: word + " ", done: false, provider: this.id, model };
    }

    const mockUsage: TokenUsage = {
      promptTokens: 120,
      completionTokens: 45,
      totalTokens: 165,
      estimatedCostUsd: calculateTokenCostUsd(model, 120, 45),
    };

    yield { text: "", done: true, finishReason: "stop", usage: mockUsage, provider: this.id, model };
  }
}
