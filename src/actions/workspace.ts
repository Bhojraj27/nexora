"use server";

import { z } from "zod";
import { requireUser, getWorkspaceAccess, requirePermission } from "@/lib/auth/context";
import {
  createWorkspace,
  updateWorkspace,
  getWorkspaceDetails,
} from "@/services/workspaceService";
import { runAction, type ActionResult } from "@/actions/helpers";
import { revalidatePath } from "next/cache";

const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export async function actionCreateWorkspace(
  input: z.infer<typeof createWorkspaceSchema>,
): Promise<ActionResult<{ workspaceId: string; redirectTo: string }>> {
  return runAction(async () => {
    const parsed = createWorkspaceSchema.parse(input);
    const user = await requireUser();
    const { workspaceId } = await createWorkspace(user, parsed.name);
    revalidatePath("/app");
    return { workspaceId, redirectTo: "/app" };
  });
}

export async function actionUpdateWorkspace(
  workspaceId: string,
  input: z.infer<typeof updateWorkspaceSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = updateWorkspaceSchema.parse(input);
    await requirePermission("workspace:update", workspaceId);
    await updateWorkspace(workspaceId, {
      name: parsed.name,
      logoUrl: parsed.logoUrl || undefined,
    });
    revalidatePath(`/app/workspace/${workspaceId}`);
    revalidatePath("/app");
  });
}

export async function actionGetWorkspaceDetails(
  workspaceId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getWorkspaceDetails>>>> {
  return runAction(async () => {
    const access = await getWorkspaceAccess(workspaceId);
    return getWorkspaceDetails(access.workspace._id.toString());
  });
}
