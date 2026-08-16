import "server-only";
import { connectDB, disconnectDB } from "@/lib/db/mongoose";
import { logger } from "@/lib/logger";
import "../models";

const MODELS = [
  { name: "User", model: import("@/models/User").then((m) => m.UserModel) },
  { name: "Workspace", model: import("@/models/Workspace").then((m) => m.WorkspaceModel) },
  { name: "WorkspaceMember", model: import("@/models/WorkspaceMember").then((m) => m.WorkspaceMemberModel) },
  { name: "Project", model: import("@/models/Project").then((m) => m.ProjectModel) },
  { name: "Document", model: import("@/models/Document").then((m) => m.DocumentModel) },
  { name: "DocumentChunk", model: import("@/models/DocumentChunk").then((m) => m.DocumentChunkModel) },
  { name: "Conversation", model: import("@/models/Conversation").then((m) => m.ConversationModel) },
  { name: "Message", model: import("@/models/Message").then((m) => m.MessageModel) },
  { name: "Invitation", model: import("@/models/Invitation").then((m) => m.InvitationModel) },
  { name: "Notification", model: import("@/models/Notification").then((m) => m.NotificationModel) },
  { name: "Usage", model: import("@/models/Usage").then((m) => m.UsageModel) },
  { name: "Subscription", model: import("@/models/Subscription").then((m) => m.SubscriptionModel) },
  { name: "AuditLog", model: import("@/models/AuditLog").then((m) => m.AuditLogModel) },
];

async function createIndexes() {
  await connectDB();

  for (const entry of MODELS) {
    const model = await entry.model;
    await model.syncIndexes();
    logger.info("indexes synced", { model: entry.name, count: model.collection.name });
  }

  logger.warn(
    "If VECTOR_SEARCH_PROVIDER=mongo, create a MongoDB Atlas vector index manually:\n" +
      "collection: documentchunks, field: embedding, similarity: cosine, dimensions: 1536 (or 64 for mock embeddings)",
  );
}

createIndexes()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error("index creation failed", { error: err instanceof Error ? err.message : String(err) });
    await disconnectDB();
    process.exit(1);
  });
