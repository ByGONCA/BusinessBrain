import { AIProvider } from "./types";
import { GeminiProvider } from "./gemini";

const providers: Map<string, AIProvider> = new Map();

/**
 * Returns the configured AI provider.
 * Supports hot-swapping or registering alternative providers (Anthropic, OpenAI, local)
 * without touching core application logic.
 */
export function getAIProvider(providerName = "gemini"): AIProvider {
  const normalized = providerName.toLowerCase();

  if (providers.has(normalized)) {
    return providers.get(normalized)!;
  }

  if (normalized === "gemini") {
    const provider = new GeminiProvider();
    providers.set("gemini", provider);
    return provider;
  }

  throw new Error(`Unsupported AI Provider: "${providerName}"`);
}

export * from "./types";
export * from "./config";

