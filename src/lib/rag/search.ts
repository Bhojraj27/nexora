import "server-only";
import { getAIProvider } from "@/lib/ai/provider";
import { getVectorStore, type VectorSearchFilter } from "@/lib/rag";
import { DocumentModel } from "@/models/Document";
import { config } from "@/lib/config";
import type { MessageSource } from "@/models/Message";
import type { RetrievalContext } from "@/lib/ai/prompts/rag";

export interface RetrieveOptions {
  workspaceId: string;
  projectId?: string;
  documentIds?: string[];
  topK?: number;
}

/**
 * Core RAG retrieval. Embeds the query, runs tenant-scoped vector search and
 * maps results to citation-ready sources. The workspaceId comes from the
 * authenticated session — never from the client — enforcing tenant isolation.
 */
export async function retrieveContext(
  query: string,
  options: RetrieveOptions,
): Promise<{ chunks: RetrievalContext[]; sources: MessageSource[] }> {
  const provider = getAIProvider();
  const vectorStore = getVectorStore();
  const topK = options.topK ?? 6;

  let queryEmbedding: number[] = [];
  try {
    const [vector] = await provider.embed([query]);
    queryEmbedding = vector;
  } catch (err) {
    if (config.isProduction) throw err;
    queryEmbedding = await fallbackEmbedding(query);
  }

  const filter: VectorSearchFilter = { workspaceId: options.workspaceId };
  if (options.projectId) filter.projectId = options.projectId;
  if (options.documentIds?.length) filter.documentIds = options.documentIds;

  const results = await vectorStore.search(queryEmbedding, filter, topK);
  if (results.length === 0) {
    // Graceful fallback: keyword search over chunks for the same tenant.
    return fallbackKeywordSearch(query, options);
  }

  const docIds = [...new Set(results.map((r) => r.documentId))];
  const docs = await DocumentModel.find({ _id: { $in: docIds }, workspaceId: options.workspaceId })
    .select("_id name")
    .lean();

  const docNames = new Map(docs.map((d) => [d._id.toString(), d.name]));

  const sources: MessageSource[] = results.map((r) => ({
    documentId: r.documentId,
    documentName: docNames.get(r.documentId) ?? "Document",
    chunkIndex: r.index,
    pageNumber: r.pageNumber,
    excerpt: r.text.slice(0, 300),
  }));

  const chunks: RetrievalContext[] = results.map((r, i) => ({
    source: sources[i],
    text: r.text,
  }));

  return { chunks, sources };
}

async function fallbackEmbedding(text: string): Promise<number[]> {
  // Cheap deterministic embedding so RAG works even if the real provider
  // fails in development.
  const { hashToVector } = await import("@/lib/ai/mockProvider");
  return hashToVector(text);
}

async function fallbackKeywordSearch(
  query: string,
  options: RetrieveOptions,
): Promise<{ chunks: RetrievalContext[]; sources: MessageSource[] }> {
  const { connectDB } = await import("@/lib/db/mongoose");
  const { DocumentChunkModel } = await import("@/models/DocumentChunk");
  await connectDB();

  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 5);

  if (tokens.length === 0) return { chunks: [], sources: [] };

  const mongoFilter: Record<string, unknown> = { workspaceId: options.workspaceId };
  if (options.projectId) mongoFilter.projectId = options.projectId;
  if (options.documentIds?.length) mongoFilter.documentId = { $in: options.documentIds };
  mongoFilter.$and = tokens.map((t) => ({ text: new RegExp(t, "i") }));

  const found = await DocumentChunkModel.find(mongoFilter)
    .select("documentId index text pageNumber")
    .limit(4)
    .lean();

  const docIds = [...new Set(found.map((c) => c.documentId.toString()))];
  const docs = await DocumentModel.find({ _id: { $in: docIds } })
    .select("_id name")
    .lean();
  const docNames = new Map(docs.map((d) => [d._id.toString(), d.name]));

  const sources: MessageSource[] = found.map((c) => ({
    documentId: c.documentId.toString(),
    documentName: docNames.get(c.documentId.toString()) ?? "Document",
    chunkIndex: c.index,
    pageNumber: c.pageNumber,
    excerpt: c.text.slice(0, 300),
  }));

  return {
    sources,
    chunks: found.map((c, i) => ({ source: sources[i], text: c.text })),
  };
}
