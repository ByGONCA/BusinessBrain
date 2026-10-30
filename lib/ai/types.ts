// ==============================================================================
// Company Brain: AI Layer Canonical Contracts & Provider Types
// ==============================================================================

export type AIRole = "system" | "user" | "assistant" | "tool";

export interface AIChatMessage {
  role: AIRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface VerifiedSource {
  id: string;
  type: "page" | "decision" | "meeting" | "pr" | "discussion" | "file";
  title: string;
  snippet: string;
  url?: string;
  author?: string;
  updatedAt?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedPromptTokens?: number;
  estimatedCostUsd?: number;
  reportedCostUsd?: number;
}

export type SupportedProviderId =
  | "gemini"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "mistral"
  | "qwen"
  | "openrouter"
  | "groq"
  | "custom_openai_compatible";

export type AITaskType =
  | "general_chat"
  | "business_analysis"
  | "financial_analysis"
  | "document_analysis"
  | "page_generation"
  | "complex_reasoning";

export interface AIModelDescriptor {
  id: string;
  displayName: string;
  contextWindowTokens: number;
  maxOutputTokens: number;
  inputCostPerMillionUsd: number;
  outputCostPerMillionUsd: number;
  cachedInputCostPerMillionUsd?: number;
  supportsStreaming: boolean;
  supportsReasoning?: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
  isDefault?: boolean;
}

export interface AIProviderMetadata {
  id: SupportedProviderId;
  displayName: string;
  defaultModel: string;
  models: AIModelDescriptor[];
  requiresApiKey: boolean;
  supportsCustomBaseUrl: boolean;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
  organizationId?: string;
  userId?: string;
  signal?: AbortSignal;
  sources?: VerifiedSource[];
  taskType?: AITaskType;
  scope?: "personal" | "org";
  isByok?: boolean;
}

export interface ChatCompletionResponse {
  text: string;
  provider: string;
  model: string;
  usage: TokenUsage;
  sources?: VerifiedSource[];
  finishReason?: "stop" | "length" | "abort" | "error";
  fallbackFrom?: string[];
  executionDurationMs?: number;
}

export interface StreamChunk {
  text: string;
  done: boolean;
  usage?: TokenUsage;
  finishReason?: "stop" | "length" | "abort" | "error";
  provider?: string;
  model?: string;
}

export type AIErrorCode =
  | "INVALID_KEY"
  | "MISSING_KEY"
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "ABORTED"
  | "PROVIDER_ERROR"
  | "FORBIDDEN"
  | "INVALID_REQUEST";

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly status: number;
  readonly provider: string;
  readonly retryable: boolean;

  constructor(message: string, code: AIErrorCode, status: number = 500, provider: string = "system", retryable: boolean = false) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.status = status;
    this.provider = provider;
    this.retryable = retryable;
    Object.setPrototypeOf(this, AIError.prototype);
  }
}

/**
 * Common interface implemented by every AI provider adapter (Gemini, OpenAI, Anthropic, DeepSeek, Mistral, etc.).
 * Guarantees zero vendor lock-in and decouples application services from specific provider APIs.
 */
export interface AIProviderAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly defaultModel: string;
  readonly metadata?: AIProviderMetadata;

  /**
   * Generates a non-streaming completion for atomic requests.
   */
  generateText(
    messages: AIChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResponse>;

  /**
   * Generates an incremental streaming completion for progressive conversational UI.
   */
  generateStream(
    messages: AIChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<StreamChunk>;

  /**
   * Validates API credentials safely without exposing secrets.
   */
  validateCredential(
    apiKey: string,
    customBaseUrl?: string
  ): Promise<{ valid: boolean; error?: string }>;
}

// Backward-compatibility aliases for existing foundation contracts
export type CompletionOptions = ChatCompletionOptions;
export interface CompletionResponse {
  text: string;
  usage?: TokenUsage;
}
export type AIProvider = AIProviderAdapter;
export interface EmbeddingOptions {
  model?: string;
}
export interface EmbeddingResponse {
  embeddings: number[][];
}
