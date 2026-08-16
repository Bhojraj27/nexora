import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { DocumentChunkModel } from "@/models/DocumentChunk";
import {
  type VectorChunk,
  type VectorSearchResult,
  type VectorStore,
  type VectorSearchFilter,
} from "@/lib/rag/vectorStore";

/**
 * MongoDB Atlas vector search ($vectorSearch). Requires an Atlas cluster with
 * a vector index named "vector_index" on documentchunks.embedding.
 * Tenant filtering is part of the query preFilter — never applied post-hoc.
 */
export class MongoVectorStore implements VectorStore {
  readonly name = "mongo";

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
    const preFilter: Record<string, unknown> = {
      workspaceId: new mongoose.Types.ObjectId(filter.workspaceId),
    };
    if (filter.projectId) preFilter.projectId = filter.projectId;
    if (filter.documentIds?.length) {
      preFilter.documentId = { $in: filter.documentIds };
    }

    const results = await DocumentChunkModel.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: query,
          numCandidates: Math.min(100, topK * 10),
          limit: topK,
          filter: preFilter,
        },
      },
      {
        $project: {
          _id: 1,
          documentId: 1,
          workspaceId: 1,
          projectId: 1,
          index: 1,
          text: 1,
          pageNumber: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    return results.map((r) => ({
      chunkId: String(r._id),
      documentId: String(r.documentId),
      workspaceId: String(r.workspaceId),
      projectId: r.projectId ? String(r.projectId) : null,
      index: r.index,
      text: r.text,
      pageNumber: r.pageNumber ?? 1,
      score: r.score ?? 0,
    }));
  }

  async deleteForDocument(documentId: string): Promise<void> {
    await connectDB();
    await DocumentChunkModel.deleteMany({ documentId });
  }
}
