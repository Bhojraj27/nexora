"use server";

import { z } from "zod";
import { requirePermission, requireUser } from "@/lib/auth/context";
import {
  createConversation,
  listConversations,
  getConversation,
  renameConversation,
  setConversationPinned,
  deleteConversation,
  suggestTitleFromQuestion,
} from "@/services/conversationService";
import { runAction, type ActionResult } from "@/actions/helpers";
import { revalidatePath } from "next/cache";

const renameSchema = z.object({ title: z.string().min(1).max(200) });

export async function actionCreateConversation(
  workspaceId: string,
  input: { projectId?: string; question?: string },
): Promise<ActionResult<{ conversationId: string }>> {
  return runAction(async () => {
    await requirePermission("ai:use", workspaceId);
    const user = await requireUser();
    const conversationId = await createConversation({
      workspaceId,
      userId: user._id.toString(),
      projectId: input.projectId,
      title: input.question ? await suggestTitleFromQuestion(input.question) : undefined,
    });
    revalidatePath(`/app/chat`);
    return { conversationId };
  });
}

export async function actionListConversations(
  workspaceId: string,
  input: { projectId?: string } = {},
): Promise<ActionResult<Awaited<ReturnType<typeof listConversations>>>> {
  return runAction(async () => {
    await requirePermission("ai:use", workspaceId);
    const user = await requireUser();
    return listConversations({
      workspaceId,
      userId: user._id.toString(),
      projectId: input.projectId,
    });
  });
}

export async function actionGetConversation(
  workspaceId: string,
  conversationId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getConversation>>>> {
  return runAction(async () => {
    await requirePermission("ai:use", workspaceId);
    return getConversation(workspaceId, conversationId);
  });
}

export async function actionRenameConversation(
  workspaceId: string,
  conversationId: string,
  input: z.infer<typeof renameSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = renameSchema.parse(input);
    await requirePermission("ai:use", workspaceId);
    await renameConversation(workspaceId, conversationId, parsed.title);
    revalidatePath(`/app/chat`);
  });
}

export async function actionSetConversationPinned(
  workspaceId: string,
  conversationId: string,
  pinned: boolean,
): Promise<ActionResult> {
  return runAction(async () => {
    await requirePermission("ai:use", workspaceId);
    await setConversationPinned(workspaceId, conversationId, pinned);
    revalidatePath(`/app/chat`);
  });
}

export async function actionDeleteConversation(
  workspaceId: string,
  conversationId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    await requirePermission("ai:use", workspaceId);
    await deleteConversation(workspaceId, conversationId);
    revalidatePath(`/app/chat`);
  });
}
