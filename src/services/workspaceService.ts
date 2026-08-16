import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { WorkspaceModel } from "@/models/Workspace";
import { WorkspaceMemberModel } from "@/models/WorkspaceMember";
import { UserModel, type User } from "@/models/User";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { updateSessionWorkspace } from "@/lib/auth/session";
import { logAudit } from "@/services/auditService";
import { getUsageStatus } from "@/services/usageService";
import { PLANS } from "@/lib/billing/plans";
import { createNotification } from "@/services/notificationService";

type ObjectId = import("mongoose").Types.ObjectId;

export async function createWorkspace(
  user: User & { _id: ObjectId },
  name: string,
): Promise<{ workspaceId: string }> {
  await connectDB();

  const membershipCount = await WorkspaceMemberModel.countDocuments({ userId: user._id });
  const firstMembership = await WorkspaceMemberModel.findOne({ userId: user._id })
    .sort({ createdAt: 1 })
    .lean();
  const usage = firstMembership
    ? await getUsageStatus(firstMembership.workspaceId.toString()).catch(() => null)
    : null;

  const plan = usage?.plan ?? "free";
  if (membershipCount >= PLANS[plan].limits.workspaces) {
    throw new ConflictError(
      `Your plan allows up to ${PLANS[plan].limits.workspaces} workspace${PLANS[plan].limits.workspaces === 1 ? "" : "s"}.`,
    );
  }

  let slug = slugify(name) || `workspace-${Date.now().toString(36)}`;
  let suffix = 1;
  while (await WorkspaceModel.exists({ slug })) {
    slug = `${slugify(name)}-${suffix}`;
    suffix += 1;
  }

  const workspace = await WorkspaceModel.create({
    name,
    slug,
    ownerId: user._id,
    plan: "free",
  });

  await WorkspaceMemberModel.create({
    workspaceId: workspace._id,
    userId: user._id,
    role: "OWNER",
  });

  await UserModel.updateOne(
    { _id: user._id },
    { $set: { onboardingCompleted: true } },
  );

  await updateSessionWorkspace(workspace._id.toString());
  await logAudit({
    workspaceId: workspace._id.toString(),
    actorId: user._id.toString(),
    actorName: user.name,
    action: "workspace.created",
    entityType: "workspace",
    entityId: workspace._id.toString(),
  });

  return { workspaceId: workspace._id.toString() };
}

export async function updateWorkspace(
  workspaceId: string,
  data: { name?: string; logoUrl?: string | null; preferences?: Record<string, unknown> },
): Promise<void> {
  await connectDB();
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) {
    update.name = data.name;
    const slug = slugify(data.name);
    if (slug) update.slug = slug;
  }
  if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl;
  if (data.preferences !== undefined) update.preferences = data.preferences;
  await WorkspaceModel.updateOne({ _id: workspaceId }, { $set: update });
}

export async function getWorkspaceDetails(workspaceId: string) {
  await connectDB();
  const [workspace, members, owner] = await Promise.all([
    WorkspaceModel.findById(workspaceId).lean(),
    WorkspaceMemberModel.find({ workspaceId })
      .populate("userId", "name email avatarUrl lastActiveAt")
      .lean(),
    WorkspaceModel.findById(workspaceId).populate("ownerId", "name email").lean(),
  ]);
  if (!workspace) throw new NotFoundError("Workspace not found");
  return { workspace, members, owner };
}

export async function countWorkspaceMembers(workspaceId: string): Promise<number> {
  await connectDB();
  return WorkspaceMemberModel.countDocuments({ workspaceId });
}

export async function inviteNotify(
  workspaceId: string,
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  await createNotification({
    workspaceId,
    userId,
    type: "member_invited",
    title,
    body,
  });
}
