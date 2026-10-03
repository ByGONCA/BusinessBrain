export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
}

export interface CompletionResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EmbeddingOptions {
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
}

/**
 * Common interface that every AI provider must implement.
 * This guarantees the application layer is completely decoupled from any single provider.
 */
export interface AIProvider {
  readonly name: string;

  /**
   * Generates a text completion for the given prompt.
   */
  generateText(prompt: string, options?: CompletionOptions): Promise<CompletionResponse>;

  /**
   * Generates a streaming text completion for conversational or progressive UI.
   */
  generateStream(
    prompt: string,
    options?: CompletionOptions
  ): AsyncIterable<string>;

  /**
   * Generates vector embeddings for semantic search or retrieval.
   */
  createEmbeddings(text: string, options?: EmbeddingOptions): Promise<EmbeddingResponse>;
}
