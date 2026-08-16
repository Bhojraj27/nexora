"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/context";
import { connectDB } from "@/lib/db/mongoose";
import { SubscriptionModel } from "@/models/Subscription";
import { WorkspaceModel } from "@/models/Workspace";
import { PLAN_TYPES, type PlanType } from "@/models/Workspace";
import { NotFoundError } from "@/lib/errors";
import { invalidateAnalytics } from "@/services/analyticsService";
import { runAction, type ActionResult } from "@/actions/helpers";
import { revalidatePath } from "next/cache";

const subscribeSchema = z.object({
  plan: z.enum(PLAN_TYPES),
});

const daysInPeriod: Record<Exclude<PlanType, "free">, number> = {
  pro: 30,
  team: 30,
};

export async function actionGetSubscription(
  workspaceId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getActiveSubscription>>>> {
  return runAction(async () => {
    await requirePermission("workspace:read", workspaceId);
    return getActiveSubscription(workspaceId);
  });
}

export async function getActiveSubscription(workspaceId: string) {
  await connectDB();
  const [subscription, workspace] = await Promise.all([
    SubscriptionModel.findOne({ workspaceId, status: { $ne: "canceled" } }).lean(),
    WorkspaceModel.findById(workspaceId).select("plan").lean(),
  ]);
  if (!workspace) throw new NotFoundError("Workspace not found");
  return {
    plan: (subscription?.plan ?? workspace.plan ?? "free") as PlanType,
    status: subscription?.status ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    provider: subscription?.provider ?? null,
  };
}

export async function actionSubscribe(
  workspaceId: string,
  input: z.infer<typeof subscribeSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = subscribeSchema.parse(input);
    await requirePermission("billing:manage", workspaceId);
    await connectDB();

    if (parsed.plan === "free") {
      await SubscriptionModel.updateOne(
        { workspaceId },
        { $set: { status: "canceled" }, $unset: { plan: "" } },
      );
      await WorkspaceModel.updateOne({ _id: workspaceId }, { $set: { plan: "free" } });
    } else {
      const periodEnd = new Date(Date.now() + daysInPeriod[parsed.plan] * 24 * 60 * 60 * 1000);
      await SubscriptionModel.updateOne(
        { workspaceId },
        {
          $set: {
            plan: parsed.plan,
            status: "active",
            provider: "mock",
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
        },
        { upsert: true },
      );
      await WorkspaceModel.updateOne({ _id: workspaceId }, { $set: { plan: parsed.plan } });
    }

    await invalidateAnalytics(workspaceId);
    revalidatePath("/app/billing");
    revalidatePath("/app/settings/billing");
  });
}

export async function actionCancelSubscription(
  workspaceId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    await requirePermission("billing:manage", workspaceId);
    await connectDB();
    await SubscriptionModel.updateOne(
      { workspaceId, status: { $ne: "canceled" } },
      { $set: { cancelAtPeriodEnd: true } },
    );
    revalidatePath("/app/billing");
  });
}
