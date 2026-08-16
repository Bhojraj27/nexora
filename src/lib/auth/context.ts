import "server-only";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import { AuthError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Permission, type Role } from "@/lib/permissions";
import { UserModel, type User } from "@/models/User";
import { WorkspaceModel, type Workspace } from "@/models/Workspace";
import { WorkspaceMemberModel, type WorkspaceMember } from "@/models/WorkspaceMember";
import { logger } from "@/lib/logger";

export interface WorkspaceAccess {
  user: User & { _id: import("mongoose").Types.ObjectId };
  workspace: Workspace & { _id: import("mongoose").Types.ObjectId };
  membership: WorkspaceMember & { _id: import("mongoose").Types.ObjectId };
}

export async function getCurrentUser(): Promise<(User & { _id: import("mongoose").Types.ObjectId }) | null> {
  const session = await getSession();
  if (!session?.sub) return null;
  await connectDB();
  const user = await UserModel.findById(session.sub).lean();
  if (!user) return null;
  return user as User & { _id: import("mongoose").Types.ObjectId };
}

export async function requireUser(): Promise<
  User & { _id: import("mongoose").Types.ObjectId }
> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

/** For pages/layouts: redirects to /login instead of throwing. */
export async function requireAuthRedirect(): Promise<
  User & { _id: import("mongoose").Types.ObjectId }
> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Loads a workspace the current user is a member of. Never trusts client-supplied IDs. */
export async function getWorkspaceAccess(
  workspaceId: string,
): Promise<WorkspaceAccess> {
  const user = await requireUser();
  if (!workspaceId || !/^[a-f0-9]{24}$/i.test(workspaceId)) {
    throw new NotFoundError("Workspace not found");
  }

  const [workspace, membership] = await Promise.all([
    WorkspaceModel.findById(workspaceId).lean(),
    WorkspaceMemberModel.findOne({ workspaceId, userId: user._id }).lean(),
  ]);

  if (!workspace) throw new NotFoundError("Workspace not found");
  if (!membership) throw new ForbiddenError("You don't have access to this workspace");

  return {
    user,
    workspace: workspace as Workspace & { _id: import("mongoose").Types.ObjectId },
    membership: membership as WorkspaceMember & {
      _id: import("mongoose").Types.ObjectId;
    },
  };
}

export async function requirePermission(
  permission: Permission,
  workspaceId: string,
): Promise<WorkspaceAccess> {
  const access = await getWorkspaceAccess(workspaceId);
  const role = access.membership.role as Role;
  if (!can(role, permission)) {
    logger.warn("permission denied", {
      workspaceId,
      userId: access.user._id.toString(),
      role,
      permission,
    });
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return access;
}

export async function getUserWorkspaceMemberships(
  userId: import("mongoose").Types.ObjectId | string,
): Promise<WorkspaceMember[]> {
  return WorkspaceMemberModel.find({ userId }).sort({ createdAt: 1 }).lean();
}

export async function getUserWorkspaces(
  userId: import("mongoose").Types.ObjectId | string,
) {
  const memberships = await getUserWorkspaceMemberships(userId);
  const ids = memberships.map((m) => m.workspaceId);
  const workspaces = await WorkspaceModel.find({ _id: { $in: ids } })
    .sort({ createdAt: 1 })
    .lean();
  return workspaces.map((ws) => {
    const m = memberships.find((x) => x.workspaceId.toString() === ws._id.toString());
    return { workspace: ws, role: m?.role ?? "VIEWER" };
  });
}

export async function resolveWorkspaceIdFromSession(
  workspaceId: string | undefined,
): Promise<string> {
  const session = await getSession();
  if (workspaceId) {
    await getWorkspaceAccess(workspaceId);
    return workspaceId;
  }
  if (session?.ws) {
    await getWorkspaceAccess(session.ws);
    return session.ws;
  }
  const user = await requireUser();
  const memberships = await getUserWorkspaceMemberships(user._id);
  if (memberships.length === 0) throw new NotFoundError("No workspace found");
  return memberships[0].workspaceId.toString();
}
