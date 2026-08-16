import "server-only";
import { config } from "@/lib/config";
import { MockAIProvider } from "@/lib/ai/mockProvider";
import { OpenAIProvider } from "@/lib/ai/openaiProvider";
import type { AIProvider } from "@/lib/ai/types";

const globalForAI = globalThis as unknown as {
  aiProvider?: AIProvider;
};

/**
 * Factory for the AI provider. The rest of the application only talks to the
 * AIProvider interface — never to a specific vendor.
 */
export function getAIProvider(): AIProvider {
  if (globalForAI.aiProvider) return globalForAI.aiProvider;

  const provider =
    config.aiProvider === "openai" && config.aiApiKey
      ? new OpenAIProvider()
      : new MockAIProvider();

  globalForAI.aiProvider = provider;
  return provider;
}

export { type AIProvider, type AIUsage, type AIChatMessage, type AIStreamResult } from "@/lib/ai/types";
