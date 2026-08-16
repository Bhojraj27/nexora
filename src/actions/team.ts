"use server";

import { z } from "zod";
import { requirePermission, requireUser } from "@/lib/auth/context";
import {
  listMembers,
  inviteMember,
  resendInvitation,
  revokeInvitation,
  acceptInvitation,
  changeMemberRole,
  removeMember,
} from "@/services/teamService";
import { ROLES, type Role } from "@/lib/permissions";
import { runAction, type ActionResult } from "@/actions/helpers";
import { revalidatePath } from "next/cache";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES),
});

const changeRoleSchema = z.object({
  targetUserId: z.string(),
  role: z.enum(ROLES),
});

export async function actionListMembers(
  workspaceId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof listMembers>>>> {
  return runAction(async () => {
    await requirePermission("workspace:read", workspaceId);
    return listMembers(workspaceId);
  });
}

export async function actionInviteMember(
  workspaceId: string,
  input: z.infer<typeof inviteSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = inviteSchema.parse(input);
    const access = await requirePermission("member:invite", workspaceId);
    await inviteMember(access, { email: parsed.email, role: parsed.role as Role });
    revalidatePath(`/app/team`);
  });
}

export async function actionResendInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const access = await requirePermission("member:invite", workspaceId);
    await resendInvitation(access, invitationId);
    revalidatePath(`/app/team`);
  });
}

export async function actionRevokeInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const access = await requirePermission("team:manage", workspaceId);
    await revokeInvitation(access, invitationId);
    revalidatePath(`/app/team`);
  });
}

export async function actionChangeMemberRole(
  workspaceId: string,
  input: z.infer<typeof changeRoleSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = changeRoleSchema.parse(input);
    const access = await requirePermission("team:manage", workspaceId);
    await changeMemberRole(access, parsed.targetUserId, parsed.role as Role);
    revalidatePath(`/app/team`);
  });
}

export async function actionRemoveMember(
  workspaceId: string,
  targetUserId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const access = await requirePermission("member:remove", workspaceId);
    await removeMember(access, targetUserId);
    revalidatePath(`/app/team`);
  });
}

export async function actionAcceptInvitation(
  token: string,
): Promise<ActionResult<{ workspaceId: string; redirectTo: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const workspaceId = await acceptInvitation(user, token);
    revalidatePath("/app");
    return { workspaceId, redirectTo: "/app" };
  });
}
