"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/context";
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getProjectStats,
} from "@/services/projectService";
import { runAction, type ActionResult } from "@/actions/helpers";
import { revalidatePath } from "next/cache";

const projectInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(20).optional(),
  color: z.string().max(20).optional(),
});

export async function actionListProjects(
  workspaceId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof listProjects>>>> {
  return runAction(async () => {
    await requirePermission("workspace:read", workspaceId);
    return listProjects(workspaceId);
  });
}

export async function actionCreateProject(
  workspaceId: string,
  input: z.infer<typeof projectInputSchema>,
): Promise<ActionResult<{ projectId: string }>> {
  return runAction(async () => {
    const parsed = projectInputSchema.parse(input);
    const access = await requirePermission("project:create", workspaceId);
    const projectId = await createProject(access, parsed);
    revalidatePath(`/app/projects`);
    return { projectId };
  });
}

export async function actionGetProject(
  workspaceId: string,
  projectId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getProject>>>> {
  return runAction(async () => {
    await requirePermission("workspace:read", workspaceId);
    return getProject(workspaceId, projectId);
  });
}

export async function actionUpdateProject(
  workspaceId: string,
  projectId: string,
  input: z.infer<typeof projectInputSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = projectInputSchema.parse(input);
    await requirePermission("project:update", workspaceId);
    await updateProject(workspaceId, projectId, parsed);
    revalidatePath(`/app/projects/${projectId}`);
  });
}

export async function actionDeleteProject(
  workspaceId: string,
  projectId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    await requirePermission("project:delete", workspaceId);
    await deleteProject(workspaceId, projectId);
    revalidatePath("/app/projects");
  });
}

export async function actionGetProjectStats(
  workspaceId: string,
  projectId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getProjectStats>>>> {
  return runAction(async () => {
    await requirePermission("workspace:read", workspaceId);
    return getProjectStats(workspaceId, projectId);
  });
}
