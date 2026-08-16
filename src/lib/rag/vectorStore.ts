import "server-only";
import type { Types } from "mongoose";

export interface VectorChunk {
  documentId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId | null;
  index: number;
  text: string;
  pageNumber: number;
  tokenCount: number;
  contentHash: string;
  embedding: number[];
}

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  workspaceId: string;
  projectId: string | null;
  index: number;
  text: string;
  pageNumber: number;
  score: number;
}

export interface VectorSearchFilter {
  workspaceId: string;
  projectId?: string;
  documentIds?: string[];
}

export interface VectorStore {
  readonly name: string;
  storeChunks(chunks: VectorChunk[]): Promise<void>;
  search(
    query: number[],
    filter: VectorSearchFilter,
    topK: number,
  ): Promise<VectorSearchResult[]>;
  deleteForDocument(documentId: string): Promise<void>;
}
