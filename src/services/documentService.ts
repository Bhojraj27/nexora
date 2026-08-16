import "server-only";
import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db/mongoose";
import { DocumentModel, type Document, type DocumentStatus, type SupportedExtension } from "@/models/Document";
import { DocumentChunkModel } from "@/models/DocumentChunk";
import { getStorage } from "@/lib/storage";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getVectorStore } from "@/lib/rag";
import { enqueueDocumentProcessing } from "@/lib/queue/queue";
import { logAudit } from "@/services/auditService";
import { formatBytes } from "@/lib/utils";
import type { WorkspaceAccess } from "@/lib/auth/context";

type ObjectId = import("mongoose").Types.ObjectId;

export interface UploadedFileInput {
  name: string;
  originalName: string;
  mimeType: string;
  extension: SupportedExtension;
  size: number;
  buffer: Buffer;
}

export interface DocumentListOptions {
  cursor?: string;
  limit?: number;
  status?: string;
  favorite?: boolean;
  search?: string;
  projectId?: string;
}

function contentChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function createDocumentRecord(
  access: WorkspaceAccess,
  input: UploadedFileInput,
): Promise<Document & { _id: ObjectId }> {
  await connectDB();

  const checksum = contentChecksum(input.buffer);

  // Duplicate detection within the workspace
  const existing = await DocumentModel.findOne({
    workspaceId: access.workspace._id,
    checksum,
  }).lean();
  if (existing) {
    throw new ValidationError(
      `"${existing.name}" was already uploaded to this workspace.`,
    );
  }

  const storageKey = `workspaces/${access.workspace._id.toString()}/documents/${crypto.randomUUID()}.${input.extension}`;
  const stored = await getStorage().save(input.buffer, storageKey, input.mimeType);

  const doc = await DocumentModel.create({
    workspaceId: access.workspace._id,
    projectId: null,
    uploadedBy: access.user._id,
    name: input.name,
    originalName: input.originalName,
    mimeType: input.mimeType,
    extension: input.extension,
    size: stored.size,
    storageKey: stored.key,
    status: "UPLOADING",
    checksum,
  });

  await logAudit({
    workspaceId: access.workspace._id.toString(),
    actorId: access.user._id.toString(),
    actorName: access.user.name,
    action: "document.uploaded",
    entityType: "document",
    entityId: doc._id.toString(),
    metadata: { name: doc.name, size: formatBytes(doc.size) },
  });

  return doc as Document & { _id: ObjectId };
}

export async function enqueueProcessing(docId: string, workspaceId: string): Promise<void> {
  await enqueueDocumentProcessing(docId, workspaceId);
}

export async function listDocuments(
  workspaceId: string,
  options: DocumentListOptions = {},
) {
  await connectDB();
  const limit = Math.min(options.limit ?? 20, 50);

  const filter: Record<string, unknown> = { workspaceId };
  if (options.status) filter.status = options.status;
  if (options.favorite !== undefined) filter.favorite = options.favorite;
  if (options.projectId) filter.projectId = options.projectId;
  if (options.cursor) filter._id = { $lt: options.cursor };

  const query = DocumentModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate("uploadedBy", "name email avatarUrl")
    .populate("projectId", "name color icon")
    .lean();

  if (options.search) {
    const regex = new RegExp(options.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.or([{ name: regex }, { tags: regex }]);
  }

  const docs = await query;
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

  return { items, nextCursor, hasMore };
}

export async function getDocument(
  workspaceId: string,
  documentId: string,
): Promise<Document & { _id: ObjectId }> {
  await connectDB();
  const doc = await DocumentModel.findOne({ _id: documentId, workspaceId })
    .populate("uploadedBy", "name email avatarUrl")
    .populate("projectId", "name color icon")
    .lean();
  if (!doc) throw new NotFoundError("Document not found");
  return doc as Document & { _id: ObjectId };
}

export async function getDocumentBuffer(
  workspaceId: string,
  documentId: string,
): Promise<{ buffer: Buffer; contentType: string; name: string }> {
  const doc = await getDocument(workspaceId, documentId);
  const buffer = await getStorage().get(doc.storageKey);
  if (!buffer) throw new NotFoundError("File content missing");
  return { buffer, contentType: doc.mimeType, name: doc.name };
}

export async function getDocumentText(
  workspaceId: string,
  documentId: string,
): Promise<string> {
  await connectDB();
  const doc = await DocumentModel.findOne({ _id: documentId, workspaceId })
    .select("textKey storageKey extension")
    .lean();
  if (!doc) throw new NotFoundError("Document not found");

  if (doc.textKey) {
    const text = await getStorage().get(doc.textKey);
    if (text) return text.toString("utf8");
  }

  // Fallback: reconstruct from chunks
  const chunks = await DocumentChunkModel.find({ documentId })
    .select("text")
    .sort({ index: 1 })
    .lean();
  if (chunks.length > 0) return chunks.map((c) => c.text).join("\n\n");

  const raw = await getStorage().get(doc.storageKey);
  if (!raw) return "";
  return raw.toString("utf8");
}

export async function renameDocument(
  workspaceId: string,
  documentId: string,
  name: string,
): Promise<void> {
  await connectDB();
  const clean = name.trim().slice(0, 200);
  if (!clean) throw new ValidationError("Name cannot be empty");
  const result = await DocumentModel.updateOne(
    { _id: documentId, workspaceId },
    { $set: { name: clean } },
  );
  if (result.matchedCount === 0) throw new NotFoundError("Document not found");
}

export async function updateDocumentMeta(
  workspaceId: string,
  documentId: string,
  data: { favorite?: boolean; tags?: string[]; projectId?: string | null },
): Promise<void> {
  await connectDB();
  const update: Record<string, unknown> = {};
  if (data.favorite !== undefined) update.favorite = data.favorite;
  if (data.tags !== undefined) update.tags = data.tags.slice(0, 10);
  if (data.projectId !== undefined) {
    update.projectId = data.projectId ? data.projectId : null;
  }
  const result = await DocumentModel.updateOne(
    { _id: documentId, workspaceId },
    { $set: update },
  );
  if (result.matchedCount === 0) throw new NotFoundError("Document not found");
}

export async function deleteDocument(
  access: WorkspaceAccess,
  documentId: string,
): Promise<void> {
  await connectDB();
  const doc = await DocumentModel.findOne({
    _id: documentId,
    workspaceId: access.workspace._id,
  }).lean();
  if (!doc) throw new NotFoundError("Document not found");

  await getVectorStore().deleteForDocument(documentId);
  await getStorage().delete(doc.storageKey);
  if (doc.textKey) await getStorage().delete(doc.textKey);
  await DocumentModel.deleteOne({ _id: documentId });
  await DocumentChunkModel.deleteMany({ documentId });

  await logAudit({
    workspaceId: access.workspace._id.toString(),
    actorId: access.user._id.toString(),
    actorName: access.user.name,
    action: "document.deleted",
    entityType: "document",
    entityId: documentId,
    metadata: { name: doc.name },
  });
}

export async function getDocumentChunksForViewer(
  workspaceId: string,
  documentId: string,
  limit = 100,
) {
  await connectDB();
  await getDocument(workspaceId, documentId);
  return DocumentChunkModel.find({ documentId, workspaceId })
    .select("index text pageNumber")
    .sort({ index: 1 })
    .limit(limit)
    .lean();
}

export async function setDocumentStatus(
  documentId: string,
  workspaceId: string,
  status: DocumentStatus,
  extra?: Partial<{ error: string; chunkCount: number; pageCount: number; textKey: string; processedAt: Date }>,
): Promise<void> {
  await connectDB();
  const update: Record<string, unknown> = { status };
  if (extra?.error !== undefined) update.error = extra.error;
  if (extra?.chunkCount !== undefined) update.chunkCount = extra.chunkCount;
  if (extra?.pageCount !== undefined) update.pageCount = extra.pageCount;
  if (extra?.textKey !== undefined) update.textKey = extra.textKey;
  if (extra?.processedAt !== undefined) update.processedAt = extra.processedAt;
  await DocumentModel.updateOne({ _id: documentId, workspaceId }, { $set: update });
}
