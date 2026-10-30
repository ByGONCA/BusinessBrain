import {
  AIProviderAdapter,
  AIChatMessage,
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  EmbeddingOptions,
  EmbeddingResponse,
} from "./types";
import { GeminiAdapter } from "./adapters/gemini";
import { DEFAULT_GEMINI_MODEL } from "./config";

/**
 * Google Gemini AI Provider implementation.
 * Wraps GeminiAdapter for backward compatibility with earlier Phase 0 placeholder references.
 */
export class GeminiProvider implements AIProviderAdapter {
  readonly id = "gemini";
  readonly displayName = "Google Gemini";
  readonly defaultModel = DEFAULT_GEMINI_MODEL;
  readonly name = "gemini";
  private adapter: GeminiAdapter;

  constructor(apiKey?: string) {
    this.adapter = new GeminiAdapter(apiKey);
  }

  async generateText(
    messages: AIChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    return this.adapter.generateText(messages, options);
  }

  async *generateStream(
    messages: AIChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<StreamChunk> {
    yield* this.adapter.generateStream(messages, options);
  }

  async validateCredential(
    apiKey: string,
    customBaseUrl?: string
  ): Promise<{ valid: boolean; error?: string }> {
    return this.adapter.validateCredential(apiKey, customBaseUrl);
  }

  async createEmbeddings(
    _text: string,
    _options?: EmbeddingOptions
  ): Promise<EmbeddingResponse> {
    throw new Error("Gemini embeddings generation is deferred to Phase 3 vector search.");
  }
}
