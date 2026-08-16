import "server-only";
import { createHash } from "node:crypto";
import type {
  AIProvider,
  AIStreamResult,
  AIUsage,
  AIChatMessage,
  AIChatOptions,
} from "@/lib/ai/types";

const MOCK_EMBEDDING_DIM = 64;
const WORDS_PER_SECOND = 22;

/**
 * Deterministic mock provider. Used automatically when no AI_API_KEY is set,
 * so the whole product (chat, RAG, summaries, quizzes, comparisons) works
 * offline. Responses are realistic and grounded in the provided context.
 */

export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly capabilities = { streaming: true, embeddings: true };

  async chat(
    messages: AIChatMessage[],
  ): Promise<{ text: string; usage: AIUsage }> {
    await new Promise((r) => setTimeout(r, 350));
    const text = this.compose(messages);
    return { text, usage: this.estimateUsage(messages, text) };
  }

  async stream(
    messages: AIChatMessage[],
    opts?: AIChatOptions,
  ): Promise<AIStreamResult> {
    const full = this.compose(messages);
    const usage = this.estimateUsage(messages, full);
    const words = full.split(/(?<=\s)/);

    const encoder = new TextEncoder();
    let cancelled = false;
    const signal = opts?.signal;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const abort = () => {
          cancelled = true;
          try {
            controller.close();
          } catch {
            // ignore
          }
        };
        signal?.addEventListener("abort", abort, { once: true });

        for (const word of words) {
          if (cancelled) return;
          controller.enqueue(encoder.encode(word));
          await new Promise((r) => setTimeout(r, 1000 / WORDS_PER_SECOND));
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
        signal?.removeEventListener("abort", abort);
      },
      cancel() {
        cancelled = true;
      },
    });

    return { stream, getUsage: async () => usage };
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => hashToVector(t));
  }

  private estimateUsage(messages: AIChatMessage[], output: string): AIUsage {
    const input = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const outputTokens = Math.max(1, Math.ceil(output.length / 4));
    return {
      inputTokens: input,
      outputTokens,
      estimatedCostUsd: input * 0.0000025 + outputTokens * 0.00001,
    };
  }

  private compose(messages: AIChatMessage[]): string {
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const history = messages.filter((m) => m.role !== "system");
    const user = history.findLast((m) => m.role === "user")?.content ?? "";
    const prior = history
      .filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .join("\n");

    // Pull the most relevant fragment from any context block the caller passed.
    const context = extractContext(system);
    const docs = context.fragments.slice(0, 3);

    const lines: string[] = [];
    lines.push(buildAnswer(user, docs, context.documentNames, prior));
    return lines.join("\n\n");
  }
}

function extractContext(system: string): {
  fragments: { text: string; doc: string }[];
  documentNames: string[];
} {
  const fragments: { text: string; doc: string }[] = [];
  const documentNames: string[] = [];

  const re = /\[DOC:([^\]]+)\]\s*\n([\s\S]*?)(?=\n\[DOC:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(system)) !== null) {
    const doc = m[1].trim();
    const text = m[2].trim().slice(0, 1200);
    if (!documentNames.includes(doc)) documentNames.push(doc);
    fragments.push({ text, doc });
  }
  return { fragments, documentNames };
}

function buildAnswer(
  question: string,
  docs: { text: string; doc: string }[],
  documentNames: string[],
  prior: string,
): string {
  const q = question.toLowerCase();
  let answer = "";

  if (docs.length === 0) {
    answer = [
      "I don't have any documents in this workspace yet to answer from.",
      "",
      "Upload a document first, then ask me anything about it — I can summarize, extract key points, compare files, and generate quizzes.",
    ].join("\n");
  } else if (/(quiz|questions?\b|test me|practice)/.test(q) && /(generate|create|make|give)/.test(q)) {
    answer = [
      "Here is a quiz generated from your knowledge base:",
      "",
      "**Question 1.** Based on the source material, which factor is most emphasized as a driver of the outcome described?",
      "A. Market timing",
      "B. Operational execution",
      "C. External regulation",
      "D. Cost structure",
      "",
      "**Question 2.** According to the document, what is the recommended next step?",
      "A. Expand aggressively",
      "B. Consolidate and validate",
      "C. Pause all activity",
      "D. Pivot the strategy",
      "",
      `_Generated from ${documentNames.join(", ")}. Use the Quiz tool for an interactive version._`,
    ].join("\n");
  } else if (/(summary|summarize|tl;?dr|overview)/.test(q)) {
    answer = [
      "Here is a concise summary of the available documents:",
      "",
      `1. **Core focus** — ${excerpt(docs[0]?.text, 220)}`,
      `2. **Key considerations** — ${excerpt(docs[1]?.text ?? docs[0]?.text, 200)}`,
      `3. **Recommended direction** — ${excerpt(docs[2]?.text ?? docs[0]?.text, 200)}`,
      "",
      `Sources: ${documentNames.join(", ")}.`,
    ].join("\n");
  } else if (/(compare|differences|vs\.?|versus)/.test(q) && documentNames.length >= 1) {
    answer = [
      "**Comparison summary**",
      "",
      `- **Scope**: ${documentNames.join(" vs ")}`,
      `- **Shared themes**: ${excerpt(docs[0]?.text, 160)}`,
      `- **Notable distinctions**: ${excerpt(docs[1]?.text, 160)}`,
      "",
      "The two sources overlap on high-level direction but differ in emphasis on operational detail.",
    ].join("\n");
  } else if (/(risk|threat|danger|concern)/.test(q)) {
    answer = [
      "Based on the available documents, three areas stand out as material risks:",
      "",
      `1. **Operational risk** — ${excerpt(docs[0]?.text, 180)}`,
      `2. **Execution risk** — ${excerpt(docs[1]?.text, 180)}`,
      `3. **External dependency risk** — ${excerpt(docs[2]?.text, 180)}`,
      "",
      `Sources: ${documentNames.join(", ")}.`,
    ].join("\n");
  } else if (/(action items|actionable|next steps|todo)/.test(q)) {
    answer = [
      "**Action items derived from your knowledge base:**",
      "",
      `1. **Validate assumptions** — ${excerpt(docs[0]?.text, 140)}`,
      `2. **Align stakeholders** — ${excerpt(docs[1]?.text, 140)}`,
      `3. **Measure impact** — ${excerpt(docs[2]?.text, 140)}`,
      "",
      "These are suggestions based on the retrieved context; verify against the full source documents.",
    ].join("\n");
  } else if (/(explain|what is|define|how does|why)/.test(q)) {
    answer = [
      excerpt(docs[0]?.text, 500),
      "",
      excerpt(docs[1]?.text ?? docs[0]?.text, 400),
    ].join("\n");
  } else {
    answer = [
      excerpt(docs[0]?.text, 600),
      "",
      excerpt(docs[1]?.text, 400),
    ].join("\n");
  }

  if (prior) {
    answer = `Following on from the earlier conversation: ${excerpt(prior, 180)}\n\n${answer}`;
  }

  return answer;
}

function excerpt(text: string, max: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

export function hashToVector(text: string): number[] {
  const dim = MOCK_EMBEDDING_DIM;
  const vector = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    for (let i = 0; i < dim; i++) {
      vector[i] += digest[i % digest.length] / 255 - 0.5;
    }
  }
  if (tokens.length === 0) {
    const digest = createHash("sha256").update(text).digest();
    for (let i = 0; i < dim; i++) {
      vector[i] = digest[i % digest.length] / 255 - 0.5;
    }
  }
  return normalize(vector);
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

export const mockEmbeddingDimension = MOCK_EMBEDDING_DIM;
