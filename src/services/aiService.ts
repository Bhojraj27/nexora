import "server-only";
import { getAIProvider } from "@/lib/ai/provider";
import {
  ragSystemPromptWithContext,
  buildRAGContext,
  type RetrievalContext,
} from "@/lib/ai/prompts/rag";
import { SUMMARIZE_PROMPT, KEY_POINTS_PROMPT, ACTION_ITEMS_PROMPT, CONTRADICTIONS_PROMPT } from "@/lib/ai/prompts/actions";
import { COMPARE_PROMPT } from "@/lib/ai/prompts/compare";
import { QUIZ_PROMPT, type QuizConfig } from "@/lib/ai/prompts/quiz";
import { retrieveContext } from "@/lib/rag/search";
import { getDocumentText } from "@/services/documentService";
import { DocumentModel } from "@/models/Document";
import { connectDB } from "@/lib/db/mongoose";
import { MessageModel } from "@/models/Message";
import { ConversationModel } from "@/models/Conversation";
import {
  appendMessage,
  createConversation,
  suggestTitleFromQuestion,
} from "@/services/conversationService";
import {
  assertAIUsageAllowed,
  recordAIUsage,
  getUsageStatus,
  maybeWarnUsage,
} from "@/services/usageService";
import { invalidateAnalytics } from "@/services/analyticsService";
import { config } from "@/lib/config";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { MessageSource } from "@/models/Message";

interface StreamEvent {
  type: "sources" | "delta" | "done" | "error";
  sources?: MessageSource[];
  text?: string;
  conversationId?: string;
  message?: string;
}

export interface StartChatInput {
  workspaceId: string;
  userId: string;
  projectId?: string;
  conversationId?: string;
  question: string;
}

export interface StartChatResult {
  stream: ReadableStream<Uint8Array>;
  sources: MessageSource[];
  conversationId: string;
}

export async function startRAGChat(input: StartChatInput): Promise<StartChatResult> {
  await connectDB();
  const question = input.question.trim().slice(0, 4000);
  if (!question) throw new ValidationError("Question cannot be empty");

  await assertAIUsageAllowed(input.workspaceId);

  // Resolve conversation
  let conversationId = input.conversationId;
  if (!conversationId) {
    conversationId = await createConversation({
      workspaceId: input.workspaceId,
      userId: input.userId,
      projectId: input.projectId,
      title: await suggestTitleFromQuestion(question),
    });
  } else {
    const exists = await ConversationModel.findOne({
      _id: conversationId,
      workspaceId: input.workspaceId,
      userId: input.userId,
    }).lean();
    if (!exists) throw new NotFoundError("Conversation not found");
    await ConversationModel.updateOne(
      { _id: conversationId },
      { $set: { title: exists.title === "New conversation" ? await suggestTitleFromQuestion(question) : exists.title } },
    );
  }

  // RAG retrieval — tenant-scoped
  const { chunks, sources } = await retrieveContext(question, {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    topK: 6,
  });

  await appendMessage({
    conversationId,
    workspaceId: input.workspaceId,
    role: "user",
    content: question,
  });

  const provider = getAIProvider();

  // Build messages with conversation history (last 6) for context continuity
  const history = await MessageModel.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();
  const historyMessages = history
    .reverse()
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const systemPrompt = ragSystemPromptWithContext(buildRAGContext(chunks));
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...historyMessages,
  ];

  let usageSnapshot = { inputTokens: 0, outputTokens: 0 };
  const { stream: providerStream, getUsage } = await provider.stream(messages, {
    maxTokens: config.aiMaxOutputTokens,
  });

  const encoder = new TextEncoder();
  const reader = providerStream.getReader();
  let assistantText = "";
  let done = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "sources",
              sources,
              conversationId,
            } satisfies StreamEvent) + "\n",
          ),
        );

        while (true) {
          const { done: providerDone, value } = await reader.read();
          if (providerDone) break;
          const text = new TextDecoder().decode(value);
          assistantText += text;
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "delta", text } satisfies StreamEvent) + "\n",
            ),
          );
        }

        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "done" } satisfies StreamEvent) + "\n"),
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "error",
              message: err instanceof Error ? err.message : "Stream failed",
            } satisfies StreamEvent) + "\n",
          ),
        );
      } finally {
        done = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
    cancel() {
      // best-effort cleanup
      reader.cancel().catch(() => undefined);
    },
  });

  // Persist assistant answer + usage after the stream completes.
  const [returnedStream, persistenceStream] = stream.tee();
  persistenceStream
    .pipeTo(new WritableStream())
    .catch(() => undefined)
    .finally(async () => {
      if (done && assistantText.trim()) {
        usageSnapshot = await getUsage();
        await appendMessage({
          conversationId,
          workspaceId: input.workspaceId,
          role: "assistant",
          content: assistantText,
          sources,
          tokens: {
            input: usageSnapshot.inputTokens,
            output: usageSnapshot.outputTokens,
          },
        });
        await recordAIUsage(input.workspaceId, {
          aiRequest: true,
          inputTokens: usageSnapshot.inputTokens,
          outputTokens: usageSnapshot.outputTokens,
        });
        await invalidateAnalytics(input.workspaceId);
        const status = await getUsageStatus(input.workspaceId);
        await maybeWarnUsage(input.workspaceId, input.userId, status);
      }
    });

  return { stream: returnedStream, sources, conversationId };
}

export interface QuizResult {
  questions: Array<{
    id: number;
    question: string;
    type: "multiple_choice" | "true_false";
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
}

export async function generateQuiz(input: {
  workspaceId: string;
  userId: string;
  documentId: string;
  config: QuizConfig;
}): Promise<QuizResult> {
  await assertAIUsageAllowed(input.workspaceId);
  const text = await getDocumentText(input.workspaceId, input.documentId);
  const limited = text.slice(0, config.aiMaxContextChars);

  const provider = getAIProvider();
  const { text: raw, usage } = await provider.chat(
    [
      { role: "system", content: QUIZ_PROMPT(input.config) },
      { role: "user", content: `Document content:\n\n${limited}` },
    ],
    { maxTokens: 4000, temperature: 0.4 },
  );

  await recordAIUsage(input.workspaceId, {
    aiRequest: true,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  await invalidateAnalytics(input.workspaceId);

  const json = extractJson(raw);
  const parsed = JSON.parse(json) as { questions?: QuizResult["questions"] };
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  if (questions.length === 0) throw new ValidationError("Failed to generate quiz");
  return { questions };
}

export async function summarizeDocument(input: {
  workspaceId: string;
  userId: string;
  documentId: string;
  mode?: "summary" | "key_points" | "action_items";
}) {
  await assertAIUsageAllowed(input.workspaceId);
  const text = await getDocumentText(input.workspaceId, input.documentId);
  const limited = text.slice(0, config.aiMaxContextChars);

  const prompt =
    input.mode === "key_points"
      ? KEY_POINTS_PROMPT
      : input.mode === "action_items"
        ? ACTION_ITEMS_PROMPT
        : SUMMARIZE_PROMPT;

  const provider = getAIProvider();
  const { text: result, usage } = await provider.chat(
    [
      { role: "system", content: prompt },
      { role: "user", content: `Document:\n\n${limited}` },
    ],
    { maxTokens: config.aiMaxOutputTokens },
  );

  await recordAIUsage(input.workspaceId, {
    aiRequest: true,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  await invalidateAnalytics(input.workspaceId);
  return { text: result, usage };
}

export async function compareDocuments(input: {
  workspaceId: string;
  userId: string;
  documentIds: [string, string];
}) {
  await assertAIUsageAllowed(input.workspaceId);
  const [aId, bId] = input.documentIds;
  const [docA, docB] = await Promise.all([
    DocumentModel.findOne({ _id: aId, workspaceId: input.workspaceId }).lean(),
    DocumentModel.findOne({ _id: bId, workspaceId: input.workspaceId }).lean(),
  ]);
  if (!docA || !docB) throw new NotFoundError("One of the documents was not found");

  const [textA, textB] = await Promise.all([
    getDocumentText(input.workspaceId, aId),
    getDocumentText(input.workspaceId, bId),
  ]);
  const half = Math.floor(config.aiMaxContextChars / 2);

  const provider = getAIProvider();
  const { text, usage } = await provider.chat(
    [
      { role: "system", content: COMPARE_PROMPT },
      {
        role: "user",
        content: `Document A (${docA.name}):\n${textA.slice(0, half)}\n\n---\n\nDocument B (${docB.name}):\n${textB.slice(0, half)}`,
      },
    ],
    { maxTokens: 3000 },
  );

  await recordAIUsage(input.workspaceId, {
    aiRequest: true,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  await invalidateAnalytics(input.workspaceId);

  return {
    text,
    usage,
    documents: [
      { id: aId, name: docA.name },
      { id: bId, name: docB.name },
    ],
  };
}

export async function findContradictions(input: {
  workspaceId: string;
  userId: string;
  documentIds: string[];
}) {
  await assertAIUsageAllowed(input.workspaceId);
  const docs = await DocumentModel.find({
    _id: { $in: input.documentIds },
    workspaceId: input.workspaceId,
  }).lean();
  if (docs.length < 2) throw new ValidationError("Select at least two documents");

  const half = Math.floor(config.aiMaxContextChars / 2);
  const texts = await Promise.all(
    docs.map((d) => getDocumentText(input.workspaceId, d._id.toString())),
  );

  const provider = getAIProvider();
  const { text, usage } = await provider.chat(
    [
      { role: "system", content: CONTRADICTIONS_PROMPT },
      {
        role: "user",
        content: docs
          .map((d, i) => `Document ${i + 1} (${d.name}):\n${texts[i].slice(0, half)}`)
          .join("\n\n---\n\n"),
      },
    ],
    { maxTokens: 2000 },
  );

  await recordAIUsage(input.workspaceId, {
    aiRequest: true,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  await invalidateAnalytics(input.workspaceId);
  return { text, usage };
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

export type { RetrievalContext };
