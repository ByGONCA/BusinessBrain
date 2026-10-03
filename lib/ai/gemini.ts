import { AIProvider, CompletionOptions, CompletionResponse, EmbeddingOptions, EmbeddingResponse } from "./types";

/**
 * Google Gemini AI Provider implementation placeholder.
 *
 * ARCHITECTURAL RULE:
 * - Direct AI calls are NOT implemented in Phase 0 Foundation.
 * - This class encapsulates configuration and prepares the provider contract for Phase 3.
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private apiKey: string | null = null;
  private defaultModel = "gemini-1.5-flash";

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || null;
  }

  private ensureConfigured() {
    if (!this.apiKey) {
      throw new Error(
        "GeminiProvider is not configured. Missing GEMINI_API_KEY environment variable."
      );
    }
  }

  async generateText(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResponse> {
    this.ensureConfigured();
    throw new Error(
      "Gemini AI generation is deferred to Phase 3. Foundation scope active."
    );
  }

  async *generateStream(
    prompt: string,
    options?: CompletionOptions
  ): AsyncIterable<string> {
    this.ensureConfigured();
    throw new Error(
      "Gemini streaming is deferred to Phase 3. Foundation scope active."
    );
  }

  async createEmbeddings(
    text: string,
    options?: EmbeddingOptions
  ): Promise<EmbeddingResponse> {
    this.ensureConfigured();
    throw new Error(
      "Gemini embeddings generation is deferred to Phase 3. Foundation scope active."
    );
  }
}
