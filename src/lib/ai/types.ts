import "server-only";

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
}

export interface AIChatOptions {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface AIStreamResult {
  stream: ReadableStream<Uint8Array>;
  getUsage(): Promise<AIUsage>;
}

export interface AICapabilities {
  streaming: boolean;
  embeddings: boolean;
}

export interface AIProvider {
  readonly name: string;
  readonly capabilities: AICapabilities;
  chat(
    messages: AIChatMessage[],
    opts?: AIChatOptions,
  ): Promise<{ text: string; usage: AIUsage }>;
  stream(
    messages: AIChatMessage[],
    opts?: AIChatOptions,
  ): Promise<AIStreamResult>;
  embed(texts: string[]): Promise<number[][]>;
}
