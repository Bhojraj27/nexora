import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { ConversationModel } from "@/models/Conversation";
import { MessageModel } from "@/models/Message";
import { NotFoundError } from "@/lib/errors";

export async function createConversation(input: {
  workspaceId: string;
  userId: string;
  projectId?: string;
  title?: string;
}): Promise<string> {
  await connectDB();
  const convo = await ConversationModel.create({
    workspaceId: input.workspaceId,
    userId: input.userId,
    projectId: input.projectId ?? null,
    title: input.title ?? "New conversation",
  });
  return convo._id.toString();
}

export async function listConversations(input: {
  workspaceId: string;
  userId: string;
  projectId?: string;
}) {
  await connectDB();
  const filter: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    userId: input.userId,
  };
  if (input.projectId) filter.projectId = input.projectId;
  return ConversationModel.find(filter)
    .sort({ pinned: -1, updatedAt: -1 })
    .limit(100)
    .lean();
}

export async function getConversation(
  workspaceId: string,
  conversationId: string,
) {
  await connectDB();
  const convo = await ConversationModel.findOne({
    _id: conversationId,
    workspaceId,
  }).lean();
  if (!convo) throw new NotFoundError("Conversation not found");
  const messages = await MessageModel.find({ conversationId })
    .sort({ createdAt: 1 })
    .lean();
  return { conversation: convo, messages };
}

export async function renameConversation(
  workspaceId: string,
  conversationId: string,
  title: string,
): Promise<void> {
  await connectDB();
  const clean = title.trim().slice(0, 200);
  if (!clean) return;
  await ConversationModel.updateOne(
    { _id: conversationId, workspaceId },
    { $set: { title: clean } },
  );
}

export async function setConversationPinned(
  workspaceId: string,
  conversationId: string,
  pinned: boolean,
): Promise<void> {
  await connectDB();
  await ConversationModel.updateOne(
    { _id: conversationId, workspaceId },
    { $set: { pinned } },
  );
}

export async function deleteConversation(
  workspaceId: string,
  conversationId: string,
): Promise<void> {
  await connectDB();
  await ConversationModel.deleteOne({ _id: conversationId, workspaceId });
  await MessageModel.deleteMany({ conversationId });
}

export async function appendMessage(input: {
  conversationId: string;
  workspaceId: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: import("@/models/Message").MessageSource[];
  tokens?: { input?: number; output?: number };
}): Promise<string> {
  await connectDB();
  const message = await MessageModel.create({
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    role: input.role,
    content: input.content,
    sources: input.sources ?? [],
    tokens: { input: input.tokens?.input ?? 0, output: input.tokens?.output ?? 0 },
  });
  await ConversationModel.updateOne(
    { _id: input.conversationId },
    {
      $inc: { messagesCount: 1 },
      $set: { lastMessageAt: new Date() },
    },
  );
  return message._id.toString();
}

export async function getConversationTitle(conversationId: string): Promise<string> {
  await connectDB();
  const convo = await ConversationModel.findById(conversationId).select("title").lean();
  return convo?.title ?? "New conversation";
}

export async function suggestTitleFromQuestion(question: string): Promise<string> {
  const clean = question.trim().replace(/\s+/g, " ");
  if (clean.length <= 60) return clean;
  return `${clean.slice(0, 57)}...`;
}
