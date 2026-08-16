import "server-only";
import { connectDB, disconnectDB } from "@/lib/db/mongoose";
import { hashPassword } from "@/lib/auth/password";
import { UserModel } from "@/models/User";
import { WorkspaceModel } from "@/models/Workspace";
import { WorkspaceMemberModel } from "@/models/WorkspaceMember";
import { ProjectModel } from "@/models/Project";
import { DocumentModel } from "@/models/Document";
import { chunkText } from "@/lib/rag/chunker";
import { getVectorStore, type VectorChunk } from "@/lib/rag";
import { getAIProvider } from "@/lib/ai/provider";
import { getStorage } from "@/lib/storage";
import { createHash } from "node:crypto";
import { config } from "@/lib/config";
import { logger } from "@/lib/logger";
import "../models";

const SAMPLE_DOCS = [
  {
    name: "NEXORA Product Guide.md",
    content: `# NEXORA Product Guide

NEXORA is an AI knowledge workspace. It lets teams upload documents — PDFs, Word files, plain text, markdown, and CSV — and ask natural-language questions about the combined knowledge base.

## How it works

1. Upload a document. The system detects the file type and extracts plain text.
2. The text is split into overlapping chunks and converted into vector embeddings.
3. When you ask a question, NEXORA finds the most relevant chunks (retrieval) and passes them to the AI along with your question (augmented generation). Answers include source citations.
4. Every answer is grounded in your documents, so the model never invents content from thin air.

## Key features

- RAG chat with markdown answers and source references
- Per-document Q&A and summaries
- Compare documents side by side
- Generate quizzes from your material
- Workspaces with roles: Owner, Admin, Member, Viewer
- Projects to organize documents into logical groups
- Usage analytics and audit logging

## Plans

- Free: up to 5 documents, 500 MB storage, 100 AI requests per month
- Pro: up to 100 documents, 20 GB storage, 5,000 AI requests per month
- Team: up to 10,000 documents, 100 GB storage, 25,000 AI requests per month`,
  },
  {
    name: "Security Best Practices.md",
    content: `# Security Best Practices

A secure AI knowledge workspace starts with good fundamentals.

## Authentication

- Use strong, unique passwords for every account.
- Enable two-factor authentication where available.
- Sessions are signed with a secret key and stored in httpOnly cookies.

## Authorization

- Every request is checked against the caller's workspace membership and role.
- Roles control what members can do: viewers can read, members can edit, admins manage the workspace, owners have full control.
- Audit logs record who did what, when.

## Data protection

- Documents are stored with random file keys, never user-supplied paths.
- Access to storage is scoped to the workspace.
- AI requests only include content the user has access to.

## Secure development

- Validate all input with typed schemas.
- Rate-limit public endpoints.
- Keep dependencies patched and secrets out of the codebase.`,
  },
];

function checksum(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function seed() {
  await connectDB();
  logger.info("seeding database…");

  const passwordHash = await hashPassword(config.demoPassword);
  const email = config.demoEmail.toLowerCase();

  const user = await UserModel.findOneAndUpdate(
    { email },
    {
      $setOnInsert: {
        email,
        passwordHash,
        name: "Demo User",
        emailVerified: true,
      },
    },
    { upsert: true, new: true },
  );

  let workspace = await WorkspaceModel.findOne({ name: "Demo Workspace" });
  if (!workspace) {
    workspace = await WorkspaceModel.create({
      name: "Demo Workspace",
      slug: "demo-workspace",
      plan: "pro",
      ownerId: user._id,
    });
  }

  await WorkspaceMemberModel.findOneAndUpdate(
    { workspaceId: workspace._id, userId: user._id },
    {
      $setOnInsert: { role: "OWNER" },
    },
    { upsert: true },
  );

  let project = await ProjectModel.findOne({ workspaceId: workspace._id, name: "Getting Started" });
  if (!project) {
    project = await ProjectModel.create({
      workspaceId: workspace._id,
      createdBy: user._id,
      name: "Getting Started",
      description: "Sample documents that demonstrate what NEXORA can do.",
    });
  }

  const storage = getStorage();
  const provider = getAIProvider();
  const vectorStore = getVectorStore();

  for (const sample of SAMPLE_DOCS) {
    const sum = checksum(sample.content);
    const existing = await DocumentModel.findOne({ workspaceId: workspace._id, checksum: sum });
    if (existing) {
      logger.info("document exists, skipping", { name: sample.name });
      continue;
    }

    const storageKey = `workspaces/${workspace._id.toString()}/documents/${crypto.randomUUID()}.md`;
    await storage.save(Buffer.from(sample.content), storageKey, "text/markdown");

    const doc = await DocumentModel.create({
      workspaceId: workspace._id,
      projectId: project._id,
      uploadedBy: user._id,
      name: sample.name,
      originalName: sample.name,
      mimeType: "text/markdown",
      extension: "md",
      size: Buffer.byteLength(sample.content),
      storageKey,
      status: "READY",
      checksum: sum,
      textKey: storageKey.replace(/\.md$/, ".txt"),
      chunkCount: 0,
    });

    const chunks = chunkText(sample.content);
    const vectors = await provider.embed(chunks.map((c) => c.text));
    const vectorChunks: VectorChunk[] = chunks.map((c, i) => ({
      documentId: doc._id,
      workspaceId: workspace._id,
      projectId: project._id,
      index: c.index,
      text: c.text,
      pageNumber: c.pageNumber,
      tokenCount: c.tokenCount,
      contentHash: c.contentHash,
      embedding: vectors[i] ?? [],
    }));
    await vectorStore.storeChunks(vectorChunks);
    await DocumentModel.updateOne({ _id: doc._id }, { chunkCount: chunks.length });

    logger.info("seeded document", { name: sample.name, chunks: chunks.length });
  }

  logger.info("seed complete", {
    user: email,
    workspace: "Demo Workspace",
    login: `http://localhost:${config.port}/login`,
    demoPassword: config.demoPassword,
  });
}

seed()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error("seed failed", { error: err instanceof Error ? err.message : String(err) });
    await disconnectDB();
    process.exit(1);
  });
