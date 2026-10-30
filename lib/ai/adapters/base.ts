// ==============================================================================
// Company Brain: Base AI Provider Adapter (Zero Third-Party SDK Bloat)
// Provides unified fetch with exponential retry, 30s timeout, SSE parsing,
// mid-stream cancellation, and rigorous credential sanitization.
// ==============================================================================

import { AIError, AIChatMessage, StreamChunk, TokenUsage } from "../types";
import { calculateTokenCostUsd } from "../config";

export abstract class BaseAIAdapter {
  protected abstract readonly id: string;
  protected defaultTimeoutMs = 30_000;
  protected maxRetries = 2;

  /**
   * Sanitizes strings to prevent credential or secret leakage in logs, errors or telemetry.
   */
  public sanitizeSecret(text: string, apiKey?: string): string {
    if (!text) return "";
    let clean = text;
    if (apiKey && apiKey.length > 5) {
      clean = clean.split(apiKey).join("[REDACTED_API_KEY]");
    }
    return clean
      .replace(/(AIzaSy)[A-Za-z0-9_-]{33}/g, "$1[REDACTED_API_KEY]")
      .replace(/(sk-ant-)[A-Za-z0-9_-]{30,}/g, "$1[REDACTED_API_KEY]")
      .replace(/(sk-)[A-Za-z0-9_-]{20,}/g, "$1[REDACTED_API_KEY]")
      .replace(/(Bearer\s+)[A-Za-z0-9_.-]{16,}/gi, "$1[REDACTED_TOKEN]");
  }

  /**
   * Executes HTTP requests with timeout, client cancellation, and exponential retry on 429/5xx.
   */
  protected async fetchWithRetry(
    url: string,
    init: RequestInit,
    clientSignal?: AbortSignal,
    apiKeyForSanitizing?: string
  ): Promise<Response> {
    let attempt = 0;

    // Check if client signal already aborted
    if (clientSignal?.aborted) {
      throw new AIError("Operação de IA cancelada pelo cliente.", "ABORTED", 499, this.id);
    }

    while (attempt <= this.maxRetries) {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), this.defaultTimeoutMs);

      // Merge client signal with timeout signal
      const onClientAbort = () => timeoutController.abort();
      if (clientSignal) {
        clientSignal.addEventListener("abort", onClientAbort, { once: true });
      }

      try {
        const response = await fetch(url, {
          ...init,
          signal: timeoutController.signal,
        });

        clearTimeout(timeoutId);
        if (clientSignal) {
          clientSignal.removeEventListener("abort", onClientAbort);
        }

        if (response.ok) {
          return response;
        }

        // Handle retryable status codes (429 Rate Limit, 502/503/504 Service Unavailable)
        if ((response.status === 429 || response.status >= 502) && attempt < this.maxRetries) {
          attempt++;
          const retryAfter = response.headers.get("retry-after");
          const delayMs = retryAfter
            ? Math.min(10_000, parseInt(retryAfter, 10) * 1000)
            : Math.min(4_000, 500 * Math.pow(2, attempt) + Math.random() * 200);

          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        // Non-retryable error: parse and throw formatted AIError
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch {
          errorBody = response.statusText;
        }

        const cleanError = this.sanitizeSecret(errorBody, apiKeyForSanitizing);

        if (response.status === 401 || response.status === 403) {
          throw new AIError(
            `Credencial inválida ou sem permissão para o fornecedor ${this.id}: ${cleanError}`,
            "INVALID_KEY",
            response.status,
            this.id
          );
        }

        if (response.status === 429) {
          throw new AIError(
            `Limite de pedidos (Rate Limit / Quota) excedido no fornecedor ${this.id}: ${cleanError}`,
            "RATE_LIMITED",
            429,
            this.id,
            true
          );
        }

        throw new AIError(
          `Erro HTTP ${response.status} no fornecedor ${this.id}: ${cleanError}`,
          "PROVIDER_ERROR",
          response.status,
          this.id
        );
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (clientSignal) {
          clientSignal.removeEventListener("abort", onClientAbort);
        }

        if (clientSignal?.aborted) {
          throw new AIError("Operação de IA cancelada pelo utilizador.", "ABORTED", 499, this.id);
        }

        if (timeoutController.signal.aborted) {
          throw new AIError(
            `Tempo limite excedido na resposta do fornecedor ${this.id} (${this.defaultTimeoutMs / 1000}s).`,
            "TIMEOUT",
            504,
            this.id,
            true
          );
        }

        if (err instanceof AIError) {
          throw err;
        }

        if (attempt < this.maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 600 * attempt));
          continue;
        }

        const rawMsg = err instanceof Error ? err.message : String(err);
        throw new AIError(
          `Falha de rede ao contactar fornecedor ${this.id}: ${this.sanitizeSecret(rawMsg, apiKeyForSanitizing)}`,
          "PROVIDER_ERROR",
          500,
          this.id,
          true
        );
      }
    }

    throw new AIError(`Falha ao contactar fornecedor ${this.id} após retries.`, "PROVIDER_ERROR", 500, this.id);
  }

  /**
   * Parses standard Server-Sent Events (SSE) data lines across chunk fragments.
   */
  protected async *parseSSEStream(
    body: ReadableStream<Uint8Array>,
    clientSignal?: AbortSignal
  ): AsyncIterable<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        if (clientSignal?.aborted) {
          throw new AIError("Streaming cancelado pelo cliente.", "ABORTED", 499, this.id);
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();
            if (data && data !== "[DONE]") {
              yield data;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Deterministic mock stream for offline testing.
   */
  protected async *generateOfflineMockStream(
    model: string,
    prompt: string,
    clientSignal?: AbortSignal
  ): AsyncIterable<StreamChunk> {
    const responseText = `[${this.id.toUpperCase()}] Resposta simulada para: "${prompt.slice(0, 40)}..." (Modelo: ${model})`;
    const words = responseText.split(" ");
    let accumulated = "";

    for (let i = 0; i < words.length; i++) {
      if (clientSignal?.aborted) {
        throw new AIError("Stream cancelado pelo cliente.", "ABORTED", 499, this.id);
      }

      const word = words[i] + (i < words.length - 1 ? " " : "");
      accumulated += word;

      yield {
        text: word,
        done: false,
        provider: this.id,
        model,
      };

      // Slight simulation tick
      await new Promise((r) => setTimeout(r, 5));
    }

    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(accumulated.length / 4);

    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: calculateTokenCostUsd(model, promptTokens, completionTokens),
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

  /**
   * Offline mock text completion.
   */
  protected generateOfflineMockText(
    model: string,
    prompt: string
  ): { text: string; usage: TokenUsage } {
    const text = `[${this.id.toUpperCase()}] Resposta simulada para: "${prompt.slice(0, 40)}..." (Modelo: ${model})`;
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(text.length / 4);

    return {
      text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCostUsd: calculateTokenCostUsd(model, promptTokens, completionTokens),
      },
    };
  }

  /**
   * Checks if offline mock mode should be used (e.g. test environment or mock keys).
   */
  protected isOfflineTestMode(apiKey?: string): boolean {
    return (
      process.env.NODE_ENV === "test" ||
      !apiKey ||
      apiKey.startsWith("mock_test_key_") ||
      apiKey === "dummy" ||
      apiKey.includes("test")
    );
  }
}
