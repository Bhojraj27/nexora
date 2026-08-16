import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { DocumentChunkModel } from "@/models/DocumentChunk";
import {
  type VectorChunk,
  type VectorSearchResult,
  type VectorStore,
  type VectorSearchFilter,
} from "@/lib/rag/vectorStore";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * JS cosine-similarity vector store. Works on any MongoDB instance (no Atlas
 * vector search required) — used for local development and the demo. Tenant
 * filtering happens in the query, never after retrieval.
 */
export class MockVectorStore implements VectorStore {
  readonly name = "mock";

  async storeChunks(chunks: VectorChunk[]): Promise<void> {
    await connectDB();
    await DocumentChunkModel.bulkWrite(
      chunks.map((c) => ({
        updateOne: {
          filter: { documentId: c.documentId, index: c.index },
          update: {
            $set: {
              workspaceId: c.workspaceId,
              projectId: c.projectId,
              text: c.text,
              pageNumber: c.pageNumber,
              tokenCount: c.tokenCount,
              contentHash: c.contentHash,
              embedding: c.embedding,
            },
          },
          upsert: true,
        },
      })),
    );
  }

  async search(
    query: number[],
    filter: VectorSearchFilter,
    topK: number,
  ): Promise<VectorSearchResult[]> {
    await connectDB();
    const mongoFilter: Record<string, unknown> = { workspaceId: filter.workspaceId };
    if (filter.projectId) mongoFilter.projectId = filter.projectId;
    if (filter.documentIds?.length) mongoFilter.documentId = { $in: filter.documentIds };

    // Candidate window: index scan with tenant filter, bounded to avoid loading everything.
    const candidates = await DocumentChunkModel.find(mongoFilter)
      .select("documentId workspaceId projectId index text pageNumber embedding")
      .limit(5000)
      .lean();

    const scored: VectorSearchResult[] = [];
    for (const doc of candidates as Array<{
      _id: import("mongoose").Types.ObjectId;
      documentId: import("mongoose").Types.ObjectId;
      workspaceId: import("mongoose").Types.ObjectId;
      projectId: import("mongoose").Types.ObjectId | null;
      index: number;
      text: string;
      pageNumber: number;
      embedding: number[];
    }>) {
      const score = cosineSimilarity(query, doc.embedding ?? []);
      if (score <= 0) continue;
      scored.push({
        chunkId: doc._id.toString(),
        documentId: doc.documentId.toString(),
        workspaceId: doc.workspaceId.toString(),
        projectId: doc.projectId ? doc.projectId.toString() : null,
        index: doc.index,
        text: doc.text,
        pageNumber: doc.pageNumber,
        score,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async deleteForDocument(documentId: string): Promise<void> {
    await connectDB();
    await DocumentChunkModel.deleteMany({ documentId });
  }
}
