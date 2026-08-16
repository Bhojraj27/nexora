import "server-only";
import { config } from "@/lib/config";
import type {
  AIProvider,
  AIStreamResult,
  AIUsage,
  AIChatMessage,
  AIChatOptions,
} from "@/lib/ai/types";

const OPENAI_URL = "https://api.openai.com/v1";
const EMBEDDING_DIM = 1536;

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly capabilities = { streaming: true, embeddings: true };

  private apiKey: string;
  private model: string;
  private embeddingModel: string;

  constructor() {
    this.apiKey = config.aiApiKey || "";
    this.model = config.aiModel;
    this.embeddingModel = config.aiEmbeddingModel;
  }

  async chat(
    messages: AIChatMessage[],
    opts?: AIChatOptions,
  ): Promise<{ text: string; usage: AIUsage }> {
    const res = await fetch(`${OPENAI_URL}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: opts?.maxTokens ?? config.aiMaxOutputTokens,
        temperature: opts?.temperature ?? 0.3,
      }),
      signal: opts?.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      text: data.choices[0]?.message?.content ?? "",
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        estimatedCostUsd: this.estimateCost(
          data.usage?.prompt_tokens ?? 0,
          data.usage?.completion_tokens ?? 0,
        ),
      },
    };
  }

  async stream(
    messages: AIChatMessage[],
    opts?: AIChatOptions,
  ): Promise<AIStreamResult> {
    const controller = new AbortController();
    const res = await fetch(`${OPENAI_URL}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: opts?.maxTokens ?? config.aiMaxOutputTokens,
        temperature: opts?.temperature ?? 0.3,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: opts?.signal,
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = new ReadableStream<Uint8Array>({
      async pull(controllerStream) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controllerStream.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload) as {
                choices?: { delta?: { content?: string } }[];
                usage?: { prompt_tokens: number; completion_tokens: number };
              };
              if (json.usage) {
                inputTokens = json.usage.prompt_tokens;
                outputTokens = json.usage.completion_tokens;
              }
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                controllerStream.enqueue(encoder.encode(content));
              }
            } catch {
              // skip malformed SSE frame
            }
          }
        } catch {
          controllerStream.error(new Error("stream interrupted"));
        }
      },
      cancel() {
        controller.abort();
        reader.cancel().catch(() => undefined);
      },
    });

    return {
      stream,
      getUsage: async () => ({
        inputTokens,
        outputTokens,
        estimatedCostUsd: this.estimateCost(inputTokens, outputTokens),
      }),
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${OPENAI_URL}/embeddings`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ model: this.embeddingModel, input: texts }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI embedding error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      data: { embedding: number[] }[];
    };
    return data.data.map((d) => d.embedding);
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    // Approximate gpt-4o-mini pricing: $0.15/M input, $0.60/M output
    return inputTokens * 0.00000015 + outputTokens * 0.0000006;
  }
}

export const openaiEmbeddingDimension = EMBEDDING_DIM;
