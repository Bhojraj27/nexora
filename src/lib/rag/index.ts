import "server-only";
import { config } from "@/lib/config";
import { MockVectorStore } from "@/lib/rag/mockVectorStore";
import { MongoVectorStore } from "@/lib/rag/mongoVectorStore";
import type { VectorStore } from "@/lib/rag/vectorStore";

const globalForVectorStore = globalThis as unknown as {
  vectorStore?: VectorStore;
};

export function getVectorStore(): VectorStore {
  if (globalForVectorStore.vectorStore) return globalForVectorStore.vectorStore;
  const store =
    config.vectorSearchProvider === "mongo"
      ? new MongoVectorStore()
      : new MockVectorStore();
  globalForVectorStore.vectorStore = store;
  return store;
}

export type {
  VectorStore,
  VectorChunk,
  VectorSearchResult,
  VectorSearchFilter,
} from "@/lib/rag/vectorStore";
