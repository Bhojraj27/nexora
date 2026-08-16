import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { DocumentModel } from "@/models/Document";
import { ProjectModel } from "@/models/Project";
import { ConversationModel } from "@/models/Conversation";
import { DocumentChunkModel } from "@/models/DocumentChunk";

export interface SearchOptions {
  query: string;
  workspaceId: string;
  projectId?: string;
  limit?: number;
}

export interface SearchResults {
  documents: Array<{ id: string; name: string; type: string; status: string }>;
  projects: Array<{ id: string; name: string; description: string }>;
  conversations: Array<{ id: string; title: string; updatedAt: Date }>;
  knowledge: Array<{ documentId: string; documentName: string; excerpt: string; pageNumber: number }>;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function globalSearch(options: SearchOptions): Promise<SearchResults> {
  await connectDB();
  const limit = Math.min(options.limit ?? 6, 10);
  const query = options.query.trim();
  if (!query) {
    return { documents: [], projects: [], conversations: [], knowledge: [] };
  }
  const regex = new RegExp(escapeRegex(query), "i");

  const base: Record<string, unknown> = { workspaceId: options.workspaceId };
  if (options.projectId) base.projectId = options.projectId;

  const [documents, projects, conversations, knowledge] = await Promise.all([
    DocumentModel.find({ ...base, $or: [{ name: regex }, { tags: regex }] })
      .select("name extension status")
      .limit(limit)
      .lean(),
    ProjectModel.find({ ...base, $or: [{ name: regex }, { description: regex }] })
      .select("name description")
      .limit(limit)
      .lean(),
    ConversationModel.find({ ...base, title: regex })
      .select("title updatedAt")
      .limit(limit)
      .lean(),
    DocumentChunkModel.find({ ...base, text: regex })
      .select("documentId text pageNumber")
      .limit(limit)
      .lean(),
  ]);

  const knowledgeDocs = await DocumentModel.find({
    _id: { $in: [...new Set(knowledge.map((k) => k.documentId))] },
    workspaceId: options.workspaceId,
  })
    .select("name")
    .lean();
  const nameMap = new Map(knowledgeDocs.map((d) => [d._id.toString(), d.name]));

  return {
    documents: documents.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      type: d.extension,
      status: d.status,
    })),
    projects: projects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description ?? "",
    })),
    conversations: conversations.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      updatedAt: c.updatedAt,
    })),
    knowledge: knowledge.map((k) => ({
      documentId: k.documentId.toString(),
      documentName: nameMap.get(k.documentId.toString()) ?? "Document",
      excerpt: k.text.slice(0, 200),
      pageNumber: k.pageNumber,
    })),
  };
}
