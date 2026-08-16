import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { ProjectModel } from "@/models/Project";
import { DocumentModel } from "@/models/Document";
import { ConversationModel } from "@/models/Conversation";
import { WorkspaceMemberModel } from "@/models/WorkspaceMember";
import { MessageModel } from "@/models/Message";
import { NotFoundError } from "@/lib/errors";
import { logAudit } from "@/services/auditService";
import type { WorkspaceAccess } from "@/lib/auth/context";

export interface ProjectInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export async function listProjects(workspaceId: string) {
  await connectDB();
  return ProjectModel.find({ workspaceId })
    .sort({ createdAt: -1 })
    .lean();
}

export async function createProject(
  access: WorkspaceAccess,
  input: ProjectInput,
): Promise<string> {
  await connectDB();
  const project = await ProjectModel.create({
    workspaceId: access.workspace._id,
    name: input.name,
    description: input.description ?? "",
    icon: input.icon ?? "folder",
    color: input.color ?? "indigo",
    createdBy: access.user._id,
  });
  await logAudit({
    workspaceId: access.workspace._id.toString(),
    actorId: access.user._id.toString(),
    actorName: access.user.name,
    action: "project.created",
    entityType: "project",
    entityId: project._id.toString(),
    metadata: { name: project.name },
  });
  return project._id.toString();
}

export async function getProject(workspaceId: string, projectId: string) {
  await connectDB();
  const project = await ProjectModel.findOne({
    _id: projectId,
    workspaceId,
  }).lean();
  if (!project) throw new NotFoundError("Project not found");
  return project;
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  data: Partial<ProjectInput>,
): Promise<void> {
  await connectDB();
  const result = await ProjectModel.updateOne(
    { _id: projectId, workspaceId },
    { $set: data },
  );
  if (result.matchedCount === 0) throw new NotFoundError("Project not found");
}

export async function deleteProject(workspaceId: string, projectId: string): Promise<void> {
  await connectDB();
  await ProjectModel.deleteOne({ _id: projectId, workspaceId });
  await DocumentModel.updateMany(
    { projectId, workspaceId },
    { $set: { projectId: null } },
  );
  await ConversationModel.updateMany(
    { projectId, workspaceId },
    { $set: { projectId: null } },
  );
}

export interface ProjectStats {
  documents: number;
  aiQuestions: number;
  storageBytes: number;
  members: number;
  conversations: number;
  readyDocuments: number;
}

export async function getProjectStats(workspaceId: string, projectId: string): Promise<ProjectStats> {
  await connectDB();
  const [documents, conversations, memberCount, messageCount] = await Promise.all([
    DocumentModel.find({ workspaceId, projectId }).select("size status").lean(),
    ConversationModel.countDocuments({ workspaceId, projectId }),
    WorkspaceMemberModel.countDocuments({ workspaceId }),
    MessageModel.countDocuments({ workspaceId, projectId }),
  ]);

  return {
    documents: documents.length,
    aiQuestions: messageCount,
    storageBytes: documents.reduce((sum, d) => sum + d.size, 0),
    members: memberCount,
    conversations,
    readyDocuments: documents.filter((d) => d.status === "READY").length,
  };
}
