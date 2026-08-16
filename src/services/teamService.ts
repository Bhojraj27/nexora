import "server-only";
import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/db/mongoose";
import { WorkspaceMemberModel } from "@/models/WorkspaceMember";
import { InvitationModel } from "@/models/Invitation";
import { UserModel } from "@/models/User";
import { WorkspaceModel } from "@/models/Workspace";
import { ForbiddenError, NotFoundError, ConflictError, ValidationError, UsageLimitError } from "@/lib/errors";
import { logAudit } from "@/services/auditService";
import { createNotification } from "@/services/notificationService";
import { getEmailProvider, buildInviteLink } from "@/services/emailService";
import { updateSessionWorkspace } from "@/lib/auth/session";
import type { WorkspaceAccess } from "@/lib/auth/context";
import { ROLES, isAdminOrAbove, roleAtLeast, type Role } from "@/lib/permissions";
import { getUsageStatus } from "@/services/usageService";
import { PLANS } from "@/lib/billing/plans";

type ObjectId = import("mongoose").Types.ObjectId;

export async function listMembers(workspaceId: string) {
  await connectDB();
  const members = await WorkspaceMemberModel.find({ workspaceId })
    .populate("userId", "name email avatarUrl lastActiveAt")
    .sort({ createdAt: 1 })
    .lean();

  const pendingInvites = await InvitationModel.find({
    workspaceId,
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .lean();

  return { members, pendingInvites };
}

export async function inviteMember(
  access: WorkspaceAccess,
  input: { email: string; role: Role },
): Promise<string> {
  await connectDB();
  const email = input.email.trim().toLowerCase();
  const role = input.role;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Invalid email address");
  }
  if (!ROLES.includes(role)) throw new ValidationError("Invalid role");

  const actorRole = access.membership.role as Role;
  if (!isAdminOrAbove(actorRole)) {
    throw new ForbiddenError("Only admins can invite members");
  }
  if (roleAtLeast(role, "ADMIN") && actorRole !== "OWNER") {
    throw new ForbiddenError("Only the workspace owner can invite admins");
  }

  const [status, activeMemberCount] = await Promise.all([
    getUsageStatus(access.workspace._id.toString()),
    WorkspaceMemberModel.countDocuments({ workspaceId: access.workspace._id }),
  ]);

  const memberLimit = PLANS[status.plan].limits.members;
  if (activeMemberCount >= memberLimit) {
    throw new UsageLimitError(
      `Your ${status.plan} plan allows up to ${memberLimit} members. Upgrade to invite more.`,
    );
  }

  const existingMember = await UserModel.findOne({ email }).lean();
  if (existingMember) {
    const already = await WorkspaceMemberModel.findOne({
      workspaceId: access.workspace._id,
      userId: existingMember._id,
    }).lean();
    if (already) throw new ConflictError("This user is already a member");
  }

  const token = randomBytes(24).toString("hex");
  await InvitationModel.create({
    workspaceId: access.workspace._id,
    email,
    role,
    token,
    invitedBy: access.user._id,
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await logAudit({
    workspaceId: access.workspace._id.toString(),
    actorId: access.user._id.toString(),
    actorName: access.user.name,
    action: "member.invited",
    entityType: "invitation",
    metadata: { email, role },
  });

  const emailProvider = getEmailProvider();
  await emailProvider.send({
    to: email,
    subject: `You've been invited to ${access.workspace.name} on NEXORA`,
    text: `Join ${access.workspace.name}: ${buildInviteLink(token)}`,
    html: `<p>${access.user.name} invited you to <strong>${access.workspace.name}</strong> on NEXORA.</p><p><a href="${buildInviteLink(token)}">Accept invitation</a></p>`,
  });

  return token;
}

export async function resendInvitation(
  access: WorkspaceAccess,
  invitationId: string,
): Promise<void> {
  await connectDB();
  const actorRole = access.membership.role as Role;
  if (!isAdminOrAbove(actorRole)) throw new ForbiddenError("Admins only");

  const invite = await InvitationModel.findOne({
    _id: invitationId,
    workspaceId: access.workspace._id,
  }).lean();
  if (!invite) throw new NotFoundError("Invitation not found");
  if (invite.status !== "pending") throw new ConflictError("Invitation is no longer pending");

  const token = randomBytes(24).toString("hex");
  await InvitationModel.updateOne(
    { _id: invitationId },
    {
      $set: {
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    },
  );

  const emailProvider = getEmailProvider();
  await emailProvider.send({
    to: invite.email,
    subject: `Invitation to ${access.workspace.name}`,
    text: `Join ${access.workspace.name}: ${buildInviteLink(token)}`,
    html: `<p>Join <strong>${access.workspace.name}</strong> on NEXORA.</p><p><a href="${buildInviteLink(token)}">Accept invitation</a></p>`,
  });
}

export async function revokeInvitation(
  access: WorkspaceAccess,
  invitationId: string,
): Promise<void> {
  await connectDB();
  const actorRole = access.membership.role as Role;
  if (!isAdminOrAbove(actorRole)) throw new ForbiddenError("Admins only");
  await InvitationModel.updateOne(
    { _id: invitationId, workspaceId: access.workspace._id },
    { $set: { status: "revoked" } },
  );
}

export async function acceptInvitation(
  user: { _id: ObjectId; name: string },
  token: string,
): Promise<string> {
  await connectDB();
  const invite = await InvitationModel.findOne({ token }).lean();
  if (!invite) throw new NotFoundError("Invitation not found or expired");
  if (invite.status !== "pending") throw new ConflictError("Invitation already used");
  if (invite.expiresAt < new Date()) {
    await InvitationModel.updateOne({ _id: invite._id }, { $set: { status: "expired" } });
    throw new ConflictError("Invitation expired");
  }

  const workspace = await WorkspaceModel.findById(invite.workspaceId).lean();
  if (!workspace) throw new NotFoundError("Workspace not found");

  // If the user is registering fresh, link by email
  let memberUser = user;
  const existing = await UserModel.findOne({ email: invite.email }).lean();
  if (existing) memberUser = { _id: existing._id, name: existing.name };

  const already = await WorkspaceMemberModel.findOne({
    workspaceId: invite.workspaceId,
    userId: memberUser._id,
  }).lean();
  if (already) {
    throw new ConflictError("You are already a member of this workspace");
  }

  await WorkspaceMemberModel.create({
    workspaceId: invite.workspaceId,
    userId: memberUser._id,
    role: invite.role,
  });

  await InvitationModel.updateOne(
    { _id: invite._id },
    { $set: { status: "accepted" } },
  );

  await createNotification({
    workspaceId: invite.workspaceId.toString(),
    userId: memberUser._id.toString(),
    type: "member_invited",
    title: `Welcome to ${workspace.name}`,
    body: `You joined the ${workspace.name} workspace.`,
  });

  await updateSessionWorkspace(invite.workspaceId.toString());
  return invite.workspaceId.toString();
}

export async function changeMemberRole(
  access: WorkspaceAccess,
  targetUserId: string,
  newRole: Role,
): Promise<void> {
  await connectDB();
  const actorRole = access.membership.role as Role;
  if (!isAdminOrAbove(actorRole)) throw new ForbiddenError("Admins only");

  const target = await WorkspaceMemberModel.findOne({
    workspaceId: access.workspace._id,
    userId: targetUserId,
  }).lean();
  if (!target) throw new NotFoundError("Member not found");

  if (target.role === "OWNER") {
    throw new ForbiddenError("The workspace owner's role cannot be changed");
  }
  if (roleAtLeast(newRole, "ADMIN") && actorRole !== "OWNER") {
    throw new ForbiddenError("Only the owner can promote to admin");
  }
  if (roleAtLeast(target.role, "ADMIN") && actorRole !== "OWNER") {
    throw new ForbiddenError("Only the owner can manage admins");
  }

  await WorkspaceMemberModel.updateOne(
    { _id: target._id },
    { $set: { role: newRole } },
  );

  await logAudit({
    workspaceId: access.workspace._id.toString(),
    actorId: access.user._id.toString(),
    actorName: access.user.name,
    action: "member.role_changed",
    entityType: "user",
    entityId: targetUserId,
    metadata: { from: target.role, to: newRole },
  });

  await createNotification({
    workspaceId: access.workspace._id.toString(),
    userId: targetUserId,
    type: "role_changed",
    title: "Your role changed",
    body: `${access.user.name} changed your role to ${newRole}.`,
  });
}

export async function removeMember(
  access: WorkspaceAccess,
  targetUserId: string,
): Promise<void> {
  await connectDB();
  const actorRole = access.membership.role as Role;
  if (!isAdminOrAbove(actorRole)) throw new ForbiddenError("Admins only");

  const target = await WorkspaceMemberModel.findOne({
    workspaceId: access.workspace._id,
    userId: targetUserId,
  }).lean();
  if (!target) throw new NotFoundError("Member not found");
  if (target.role === "OWNER") throw new ForbiddenError("Cannot remove the workspace owner");

  await WorkspaceMemberModel.deleteOne({ _id: target._id });

  await logAudit({
    workspaceId: access.workspace._id.toString(),
    actorId: access.user._id.toString(),
    actorName: access.user.name,
    action: "member.removed",
    entityType: "user",
    entityId: targetUserId,
  });
}
