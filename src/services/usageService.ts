import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { UsageModel } from "@/models/Usage";
import { WorkspaceModel, type PlanType } from "@/models/Workspace";
import { SubscriptionModel } from "@/models/Subscription";
import { PLANS } from "@/lib/billing/plans";
import { UsageLimitError } from "@/lib/errors";
import { enqueueNotification } from "@/lib/queue/queue";

export function currentMonthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export interface UsageStatus {
  plan: PlanType;
  month: string;
  documents: number;
  storageBytes: number;
  aiRequests: number;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
  limits: {
    documents: number;
    aiRequestsPerMonth: number;
    storageBytes: number;
    workspaces: number;
  };
  aiPercent: number;
  documentPercent: number;
  storagePercent: number;
}

export async function getOrCreateUsage(
  workspaceId: string,
  month = currentMonthKey(),
) {
  await connectDB();
  const usage = await UsageModel.findOneAndUpdate(
    { workspaceId, month },
    { $setOnInsert: { workspaceId, month } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return usage;
}

export async function getWorkspacePlan(workspaceId: string): Promise<PlanType> {
  await connectDB();
  const [workspace, subscription] = await Promise.all([
    WorkspaceModel.findById(workspaceId).select("plan").lean(),
    SubscriptionModel.findOne({ workspaceId, status: { $ne: "canceled" } })
      .select("plan")
      .lean(),
  ]);
  // Subscription (paid) overrides the workspace default plan.
  return (subscription?.plan ?? workspace?.plan ?? "free") as PlanType;
}

export async function recordAIUsage(
  workspaceId: string,
  data: { inputTokens?: number; outputTokens?: number; aiRequest?: boolean },
): Promise<void> {
  await connectDB();
  const month = currentMonthKey();
  const inc: Record<string, number> = {
    inputTokens: data.inputTokens ?? 0,
    outputTokens: data.outputTokens ?? 0,
    estCostUsd: (data.inputTokens ?? 0) * 0.00000015 + (data.outputTokens ?? 0) * 0.0000006,
  };
  if (data.aiRequest) inc.aiRequests = 1;
  await UsageModel.updateOne({ workspaceId, month }, { $inc: inc }, { upsert: true });
}

export async function recordDocumentUsage(
  workspaceId: string,
  data: { storageBytes: number; count?: number },
): Promise<void> {
  await connectDB();
  const month = currentMonthKey();
  const inc: Record<string, unknown> = { storageBytes: data.storageBytes };
  if (data.count) inc.documents = data.count;
  await UsageModel.updateOne(
    { workspaceId, month },
    { $inc: inc },
    { upsert: true },
  );
}

export async function getUsageStatus(workspaceId: string): Promise<UsageStatus> {
  await connectDB();
  const plan = await getWorkspacePlan(workspaceId);
  const limits = PLANS[plan].limits;
  const usage = await getOrCreateUsage(workspaceId);

  return {
    plan,
    month: usage.month,
    documents: usage.documents,
    storageBytes: usage.storageBytes,
    aiRequests: usage.aiRequests,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estCostUsd: usage.estCostUsd,
    limits: {
      documents: limits.documents,
      aiRequestsPerMonth: limits.aiRequestsPerMonth,
      storageBytes: limits.storageBytes,
      workspaces: limits.workspaces,
    },
    aiPercent: Math.min(100, Math.round((usage.aiRequests / limits.aiRequestsPerMonth) * 100)),
    documentPercent: Math.min(100, Math.round((usage.documents / limits.documents) * 100)),
    storagePercent: Math.min(100, Math.round((usage.storageBytes / limits.storageBytes) * 100)),
  };
}

export async function assertAIUsageAllowed(workspaceId: string): Promise<void> {
  const status = await getUsageStatus(workspaceId);
  if (status.aiRequests >= status.limits.aiRequestsPerMonth) {
    throw new UsageLimitError(
      `Monthly AI question limit (${status.limits.aiRequestsPerMonth.toLocaleString()}) reached. Upgrade your plan to continue.`,
    );
  }
}

export async function assertStorageAllowed(
  workspaceId: string,
  incomingBytes: number,
): Promise<void> {
  const status = await getUsageStatus(workspaceId);
  if (status.storageBytes + incomingBytes > status.limits.storageBytes) {
    throw new UsageLimitError(
      "Storage limit reached. Upgrade your plan or remove old documents.",
    );
  }
}

export async function assertDocumentAllowed(workspaceId: string): Promise<void> {
  const status = await getUsageStatus(workspaceId);
  if (status.documents >= status.limits.documents) {
    throw new UsageLimitError(
      `Document limit (${status.limits.documents}) reached. Upgrade your plan to upload more documents.`,
    );
  }
}

/** Warns via notification once a plan reaches 80% usage. */
export async function maybeWarnUsage(
  workspaceId: string,
  userId: string,
  status: UsageStatus,
): Promise<void> {
  if (status.aiPercent >= 80 && status.aiPercent < 90) {
    await enqueueNotification({
      workspaceId,
      userId,
      type: "usage_warning",
      title: "AI usage approaching limit",
      body: `You've used ${status.aiRequests} of ${status.limits.aiRequestsPerMonth.toLocaleString()} AI questions this month.`,
    });
  }
}
