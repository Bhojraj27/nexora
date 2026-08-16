"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/context";
import {
  listDocuments,
  getDocument,
  getDocumentText,
  getDocumentChunksForViewer,
  renameDocument,
  updateDocumentMeta,
  deleteDocument,
} from "@/services/documentService";
import { runAction, type ActionResult } from "@/actions/helpers";
import { revalidatePath } from "next/cache";

const renameSchema = z.object({ name: z.string().min(1).max(200) });

const metaSchema = z.object({
  favorite: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  projectId: z.string().nullable().optional(),
});

export async function actionListDocuments(
  workspaceId: string,
  options: { cursor?: string; limit?: number; search?: string; projectId?: string } = {},
): Promise<ActionResult<Awaited<ReturnType<typeof listDocuments>>>> {
  return runAction(async () => {
    await requirePermission("document:read", workspaceId);
    return listDocuments(workspaceId, options);
  });
}

export async function actionGetDocument(
  workspaceId: string,
  documentId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getDocument>>>> {
  return runAction(async () => {
    await requirePermission("document:read", workspaceId);
    return getDocument(workspaceId, documentId);
  });
}

export async function actionGetDocumentText(
  workspaceId: string,
  documentId: string,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    await requirePermission("document:read", workspaceId);
    return getDocumentText(workspaceId, documentId);
  });
}

export async function actionGetDocumentChunks(
  workspaceId: string,
  documentId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getDocumentChunksForViewer>>>> {
  return runAction(async () => {
    await requirePermission("document:read", workspaceId);
    return getDocumentChunksForViewer(workspaceId, documentId);
  });
}

export async function actionRenameDocument(
  workspaceId: string,
  documentId: string,
  input: z.infer<typeof renameSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = renameSchema.parse(input);
    await requirePermission("document:update", workspaceId);
    await renameDocument(workspaceId, documentId, parsed.name);
    revalidatePath(`/app/documents`);
    revalidatePath(`/app/documents/${documentId}`);
  });
}

export async function actionUpdateDocumentMeta(
  workspaceId: string,
  documentId: string,
  input: z.infer<typeof metaSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = metaSchema.parse(input);
    await requirePermission("document:update", workspaceId);
    await updateDocumentMeta(workspaceId, documentId, parsed);
    revalidatePath(`/app/documents/${documentId}`);
  });
}

export async function actionDeleteDocument(
  workspaceId: string,
  documentId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const access = await requirePermission("document:delete", workspaceId);
    await deleteDocument(access, documentId);
    revalidatePath(`/app/documents`);
  });
}
