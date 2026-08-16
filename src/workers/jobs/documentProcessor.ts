import "server-only";
import { getStorage } from "@/lib/storage";
import { extractText, normalizeText } from "@/lib/documents/extract";
import { chunkText } from "@/lib/rag/chunker";
import { getVectorStore, type VectorChunk } from "@/lib/rag";
import { getAIProvider } from "@/lib/ai/provider";
import { DocumentModel } from "@/models/Document";
import { setDocumentStatus } from "@/services/documentService";
import { recordDocumentUsage } from "@/services/usageService";
import { invalidateAnalytics } from "@/services/analyticsService";
import { enqueueNotification } from "@/lib/queue/queue";
import { logger } from "@/lib/logger";

export interface DocumentJobData {
  documentId: string;
  workspaceId: string;
}

function safeError(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 500) : "Unknown processing error";
}

/**
 * Full document-processing pipeline:
 * EXTRACTING → (extract text) → INDEXING → (chunk + embed + store) → READY
 */
export async function processDocumentJob(data: DocumentJobData): Promise<{ status: string; chunks: number }> {
  const { documentId, workspaceId } = data;
  const doc = await DocumentModel.findOne({
    _id: documentId,
    workspaceId,
  }).lean();

  if (!doc) {
    logger.warn("document job skipped: not found", { documentId, workspaceId });
    return { status: "SKIPPED", chunks: 0 };
  }

  try {
    await setDocumentStatus(documentId, workspaceId, "EXTRACTING");

    const buffer = await getStorage().get(doc.storageKey);
    if (!buffer) {
      throw new Error("File content missing from storage");
    }

    const { text, pageCount } = await extractText(buffer, doc.extension);
    const normalized = normalizeText(text);

    const textKey = doc.storageKey.replace(/\.[^/.]+$/, ".txt");
    await getStorage().save(Buffer.from(normalized), textKey, "text/plain");

    await setDocumentStatus(documentId, workspaceId, "INDEXING", {
      textKey,
      pageCount,
    });

    const chunks = chunkText(normalized);
    const provider = getAIProvider();
    const vectors = await provider.embed(chunks.map((c) => c.text));

    const vectorChunks: VectorChunk[] = chunks.map((c, i) => ({
      documentId: doc._id,
      workspaceId: doc.workspaceId,
      projectId: doc.projectId ?? null,
      index: c.index,
      text: c.text,
      pageNumber: c.pageNumber,
      tokenCount: c.tokenCount,
      contentHash: c.contentHash,
      embedding: vectors[i] ?? [],
    }));

    const vectorStore = getVectorStore();
    await vectorStore.deleteForDocument(documentId);
    await vectorStore.storeChunks(vectorChunks);

    await setDocumentStatus(documentId, workspaceId, "READY", {
      chunkCount: chunks.length,
      pageCount,
      processedAt: new Date(),
    });

    await recordDocumentUsage(workspaceId, {
      storageBytes: doc.size,
      count: 1,
    });
    await invalidateAnalytics(workspaceId);

    await enqueueNotification({
      workspaceId,
      userId: doc.uploadedBy.toString(),
      type: "document_processed",
      title: "Document ready",
      body: `${doc.name} was processed and is ready to answer questions.`,
      data: { documentId, workspaceId },
    });

    logger.info("document processed", {
      documentId,
      workspaceId,
      chunks: chunks.length,
      pages: pageCount,
    });

    return { status: "READY", chunks: chunks.length };
  } catch (err) {
    const message = safeError(err);
    await setDocumentStatus(documentId, workspaceId, "FAILED", { error: message });

    await enqueueNotification({
      workspaceId,
      userId: doc.uploadedBy.toString(),
      type: "document_failed",
      title: "Document processing failed",
      body: `${doc.name} could not be processed: ${message}`,
      data: { documentId, workspaceId },
    });

    logger.error("document processing failed", {
      documentId,
      workspaceId,
      error: message,
    });
    throw err;
  }
}
