"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { BarChart3, Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";

interface AnalyticsResponse {
  data: {
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
    usage: {
      plan: string;
      aiRequests: number;
      aiPercent: number;
      documents: number;
      documentPercent: number;
      storageBytes: number;
      storagePercent: number;
      limits: { aiRequestsPerMonth: number; documents: number; storageBytes: number };
    };
  };
}

export function AnalyticsClient() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?workspaceId=${workspaceId}&scope=full`);
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = (await res.json()) as AnalyticsResponse;
      return json.data;
    },
    enabled: Boolean(workspaceId),
  });

  const usage = data?.usage;
  const metrics = data?.metrics;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Workspace activity and usage across the last 30 days.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Documents" value={String(metrics?.documents ?? 0)} />
            <MetricCard label="AI questions" value={(metrics?.aiQuestions ?? 0).toLocaleString()} />
            <MetricCard label="Active members" value={String(metrics?.activeMembers ?? 0)} />
            <MetricCard label="Storage used" value={formatBytes(metrics?.storageBytes ?? 0)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>AI questions over time</CardTitle>
                <CardDescription>Questions asked per day (30 days)</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.aiQuestionsOverTime}>
                    <defs>
                      <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-primary)"
                      fill="url(#aiGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documents over time</CardTitle>
                <CardDescription>Documents uploaded per day (30 days)</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.documentsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly usage</CardTitle>
              <CardDescription>
                {usage?.plan} plan · resets monthly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsageRow
                label="AI questions"
                used={usage?.aiRequests ?? 0}
                limit={usage?.limits.aiRequestsPerMonth ?? 0}
                percent={usage?.aiPercent ?? 0}
              />
              <UsageRow
                label="Documents"
                used={usage?.documents ?? 0}
                limit={usage?.limits.documents ?? 0}
                percent={usage?.documentPercent ?? 0}
              />
              <UsageRow
                label="Storage"
                used={usage?.storageBytes ?? 0}
                limit={usage?.limits.storageBytes ?? 0}
                percent={usage?.storagePercent ?? 0}
                displayLimit={formatBytes(usage?.limits.storageBytes ?? 0)}
              />
            </CardContent>
          </Card>

          {data.aiUsageByProject.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> AI usage by project
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.aiUsageByProject.map((p) => {
                  const max = Math.max(...data.aiUsageByProject.map((x) => x.questions), 1);
                  return (
                    <div key={p.projectId} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{p.projectName}</span>
                        <span className="text-muted-foreground">{p.questions} questions</span>
                      </div>
                      <Progress value={(p.questions / max) * 100} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!isLoading && !data && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function UsageRow({
  label,
  used,
  limit,
  percent,
  displayLimit,
}: {
  label: string;
  used: number;
  limit: number;
  percent: number;
  displayLimit?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {used.toLocaleString()} / {displayLimit ?? limit.toLocaleString()}
        </span>
      </div>
      <Progress value={Math.min(percent, 100)} />
    </div>
  );
}
