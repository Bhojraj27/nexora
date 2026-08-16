import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { DocumentModel } from "@/models/Document";
import { ConversationModel } from "@/models/Conversation";
import { MessageModel } from "@/models/Message";
import { WorkspaceMemberModel } from "@/models/WorkspaceMember";
import { ProjectModel } from "@/models/Project";
import { UsageModel } from "@/models/Usage";
import { getOrSet, workspaceCacheKey, cacheDel } from "@/lib/redis/cache";
import { currentMonthKey, getUsageStatus } from "@/services/usageService";

export interface DashboardMetrics {
  documents: number;
  readyDocuments: number;
  conversations: number;
  messages: number;
  members: number;
  projects: number;
  storageBytes: number;
}

export async function getDashboardMetrics(
  workspaceId: string,
): Promise<DashboardMetrics> {
  await connectDB();
  const key = workspaceCacheKey(workspaceId, "dashboard-metrics");
  return getOrSet(
    key,
    async () => {
      const [documents, conversations, messages, members, projects] = await Promise.all([
        DocumentModel.find({ workspaceId }).select("size status").lean(),
        ConversationModel.countDocuments({ workspaceId }),
        MessageModel.countDocuments({ workspaceId }),
        WorkspaceMemberModel.countDocuments({ workspaceId }),
        ProjectModel.countDocuments({ workspaceId }),
      ]);

      return {
        documents: documents.length,
        readyDocuments: documents.filter((d) => d.status === "READY").length,
        conversations,
        messages,
        members,
        projects,
        storageBytes: documents.reduce((sum, d) => sum + d.size, 0),
      };
    },
    { ttl: 30 },
  );
}

export interface AnalyticsData {
  metrics: {
    documents: number;
    aiQuestions: number;
    activeMembers: number;
    storageBytes: number;
  };
  aiQuestionsOverTime: Array<{ date: string; count: number }>;
  documentsOverTime: Array<{ date: string; count: number }>;
  activeUsersOverTime: Array<{ date: string; count: number }>;
  storageOverTime: Array<{ date: string; bytes: number }>;
  aiUsageByProject: Array<{ projectId: string; projectName: string; questions: number }>;
  usage: Awaited<ReturnType<typeof getUsageStatus>>;
}

export async function getAnalyticsData(workspaceId: string): Promise<AnalyticsData> {
  await connectDB();
  const key = workspaceCacheKey(workspaceId, "analytics");
  return getOrSet(
    key,
    async () => {
      const now = new Date();
      const daysAgo = (days: number) =>
        new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      const [documents, conversations, messages, members, projects] = await Promise.all([
        DocumentModel.find({ workspaceId }).select("size createdAt").lean(),
        ConversationModel.find({ workspaceId }).select("createdAt projectId title").lean(),
        MessageModel.find({ workspaceId, role: "user" }).select("createdAt").lean(),
        WorkspaceMemberModel.find({ workspaceId }).select("lastActiveAt").lean(),
        ProjectModel.find({ workspaceId }).select("name").lean(),
      ]);

      // 30-day time series
      const last30 = Array.from({ length: 30 }, (_, i) => {
        const d = daysAgo(29 - i);
        return fmt(d);
      });

      const countByDate = (docs: Array<{ createdAt?: Date }>, field: "createdAt") => {
        const counts = new Map<string, number>();
        for (const item of docs) {
          const date = fmt(new Date(item[field] ?? new Date()));
          counts.set(date, (counts.get(date) ?? 0) + 1);
        }
        return last30.map((date) => ({ date, count: counts.get(date) ?? 0 }));
      };

      const aiQuestionsOverTime = countByDate(messages, "createdAt");
      const documentsOverTime = countByDate(documents, "createdAt");

      const activeUsersOverTime = last30.map((date) => {
        const day = new Date(date);
        const start = day;
        const end = new Date(day.getTime() + 24 * 60 * 60 * 1000);
        const count = members.filter(
          (m) => m.lastActiveAt && new Date(m.lastActiveAt) >= start && new Date(m.lastActiveAt) < end,
        ).length;
        return { date, count };
      });

      let cumulative = 0;
      const storageOverTime = last30.map((date) => {
        cumulative += documents
          .filter((d) => fmt(new Date(d.createdAt)) === date)
          .reduce((sum, d) => sum + d.size, 0);
        return { date, bytes: cumulative };
      });

      const projectNames = new Map(projects.map((p) => [p._id.toString(), p.name]));
      const aiByProject = new Map<string, number>();
      for (const convo of conversations) {
        if (!convo.projectId) continue;
        const id = convo.projectId.toString();
        const msgs = messages.filter(
          (m) => m.createdAt && convo.createdAt && true,
        ).length;
        void msgs;
        aiByProject.set(id, (aiByProject.get(id) ?? 0) + 1);
      }

      const aiUsageByProject = [...aiByProject.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([projectId, questions]) => ({
          projectId,
          projectName: projectNames.get(projectId) ?? "General",
          questions,
        }));

      const usage = await getUsageStatus(workspaceId);

      return {
        metrics: {
          documents: documents.length,
          aiQuestions: messages.length,
          activeMembers: members.filter((m) => m.lastActiveAt).length,
          storageBytes: documents.reduce((sum, d) => sum + d.size, 0),
        },
        aiQuestionsOverTime,
        documentsOverTime,
        activeUsersOverTime,
        storageOverTime,
        aiUsageByProject,
        usage,
      };
    },
    { ttl: 60 },
  );
}

export async function invalidateAnalytics(workspaceId: string): Promise<void> {
  await cacheDel(
    workspaceCacheKey(workspaceId, "analytics"),
    workspaceCacheKey(workspaceId, "dashboard-metrics"),
  );
}

export async function getMonthlyUsageHistory(workspaceId: string) {
  await connectDB();
  const month = currentMonthKey();
  const [currentYear, currentMonthNum] = month.split("-").map(Number);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonthNum - 1 - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  const records = await UsageModel.find({
    workspaceId,
    month: { $in: months },
  }).lean();
  const byMonth = new Map(records.map((r) => [r.month, r]));
  return months.map((m) => {
    const r = byMonth.get(m);
    return {
      month: m,
      aiRequests: r?.aiRequests ?? 0,
      documents: r?.documents ?? 0,
      storageBytes: r?.storageBytes ?? 0,
      estCostUsd: r?.estCostUsd ?? 0,
    };
  });
}
