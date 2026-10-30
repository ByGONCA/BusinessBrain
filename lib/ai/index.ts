import { AIProviderAdapter, SupportedProviderId, AIError } from "./types";
import { GeminiAdapter } from "./adapters/gemini";
import { OpenAIAdapter } from "./adapters/openai";
import { AnthropicAdapter } from "./adapters/anthropic";
import { DeepSeekAdapter } from "./adapters/deepseek";
import { MistralAdapter } from "./adapters/mistral";

const providerRegistry: Map<string, AIProviderAdapter> = new Map();

// Initialize canonical default providers
providerRegistry.set("gemini", new GeminiAdapter());
providerRegistry.set("openai", new OpenAIAdapter());
providerRegistry.set("anthropic", new AnthropicAdapter());
providerRegistry.set("deepseek", new DeepSeekAdapter());
providerRegistry.set("mistral", new MistralAdapter());

/**
 * Registers an AI Provider Adapter in the registry.
 * Enables hot-swapping or registering custom/BYOK adapters without modifying application logic.
 */
export function registerAIProvider(adapter: AIProviderAdapter): void {
  providerRegistry.set(adapter.id.toLowerCase(), adapter);
}

/**
 * Resolves the appropriate provider ID from a model identifier.
 */
export function resolveProviderForModel(modelName?: string): SupportedProviderId {
  if (!modelName) return "gemini";
  const normalized = modelName.toLowerCase().trim();

  // Model-to-provider routing
  if (normalized.startsWith("gemini-")) return "gemini";
  if (normalized.startsWith("gpt-") || normalized.startsWith("o1-") || normalized.startsWith("o3-")) return "openai";
  if (normalized.startsWith("claude-")) return "anthropic";
  if (normalized.startsWith("deepseek-")) return "deepseek";
  if (normalized.startsWith("mistral-") || normalized.startsWith("codestral-")) return "mistral";
  if (normalized.startsWith("qwen-")) return "qwen";

  return "gemini";
}

/**
 * Returns the requested AI Provider Adapter from the registry.
 * If custom credentials are provided, instantiates an ad-hoc adapter configured with the BYOK key.
 */
export function getAIProvider(
  providerId = "gemini",
  customCredentials?: { apiKey?: string; customBaseUrl?: string }
): AIProviderAdapter {
  const normalized = providerId.toLowerCase() as SupportedProviderId;

  // Ad-hoc instance for custom BYOK key or custom base URL
  if (customCredentials?.apiKey || customCredentials?.customBaseUrl) {
    switch (normalized) {
      case "gemini":
        return new GeminiAdapter(customCredentials.apiKey);
      case "openai":
        return new OpenAIAdapter(customCredentials.apiKey, customCredentials.customBaseUrl);
      case "anthropic":
        return new AnthropicAdapter(customCredentials.apiKey, customCredentials.customBaseUrl);
      case "deepseek":
        return new DeepSeekAdapter(customCredentials.apiKey, customCredentials.customBaseUrl);
      case "mistral":
        return new MistralAdapter(customCredentials.apiKey, customCredentials.customBaseUrl);
      default:
        return new OpenAIAdapter(customCredentials.apiKey, customCredentials.customBaseUrl);
    }
  }

  if (providerRegistry.has(normalized)) {
    return providerRegistry.get(normalized)!;
  }

  // Lazy-initialize known providers if missing from Map
  switch (normalized) {
    case "gemini": {
      const adapter = new GeminiAdapter();
      providerRegistry.set("gemini", adapter);
      return adapter;
    }
    case "openai": {
      const adapter = new OpenAIAdapter();
      providerRegistry.set("openai", adapter);
      return adapter;
    }
    case "anthropic": {
      const adapter = new AnthropicAdapter();
      providerRegistry.set("anthropic", adapter);
      return adapter;
    }
    case "deepseek": {
      const adapter = new DeepSeekAdapter();
      providerRegistry.set("deepseek", adapter);
      return adapter;
    }
    case "mistral": {
      const adapter = new MistralAdapter();
      providerRegistry.set("mistral", adapter);
      return adapter;
    }
    default:
      throw new AIError(
        `Unsupported AI Provider: "${providerId}". Registered providers: ${Array.from(providerRegistry.keys()).join(", ")}`,
        "PROVIDER_ERROR",
        400,
        providerId
      );
  }
}

/**
 * Lists all registered AI Provider Adapters with metadata.
 */
export function listSupportedProviders(): Array<{ id: string; displayName: string; defaultModel: string }> {
  return Array.from(providerRegistry.values()).map((p) => ({
    id: p.id,
    displayName: p.displayName,
    defaultModel: p.defaultModel,
  }));
}

export * from "./types";
export * from "./config";
export { GeminiAdapter } from "./adapters/gemini";
export { OpenAIAdapter } from "./adapters/openai";
export { AnthropicAdapter } from "./adapters/anthropic";
export { DeepSeekAdapter } from "./adapters/deepseek";
export { MistralAdapter } from "./adapters/mistral";
