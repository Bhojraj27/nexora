import Link from "next/link";
import { FileText, MessageSquare, Users, HardDrive, ArrowRight, Upload } from "lucide-react";
import { getDashboardMetrics } from "@/services/analyticsService";
import { getUsageStatus } from "@/services/usageService";
import { getWorkspaceAccess } from "@/lib/auth/context";
import { getSession } from "@/lib/auth/session";
import { listDocuments } from "@/services/documentService";
import { listProjects } from "@/services/projectService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const workspaceId = session?.ws;

  if (!workspaceId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">No active workspace. Switch workspaces.</p>
      </div>
    );
  }

  const access = await getWorkspaceAccess(workspaceId);
  const [metrics, usage, documents, projects] = await Promise.all([
    getDashboardMetrics(workspaceId),
    getUsageStatus(workspaceId),
    listDocuments(workspaceId, { limit: 5 }),
    listProjects(workspaceId),
  ]);

  const stats = [
    { label: "Documents", value: String(metrics.documents), icon: FileText, href: "/app/documents" },
    { label: "Conversations", value: String(metrics.conversations), icon: MessageSquare, href: "/app/chat" },
    { label: "Team members", value: String(metrics.members), icon: Users, href: "/app/team" },
    { label: "Storage used", value: formatBytes(metrics.storageBytes), icon: HardDrive, href: "/app/analytics" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Welcome back, {access.user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening in {access.workspace.name}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/app/chat">
              <MessageSquare className="h-4 w-4" /> Ask AI
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/app/documents?upload=1">
              <Upload className="h-4 w-4" /> Upload
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="transition-colors hover:border-border-strong">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-tight">{value}</p>
                  <p className="truncate text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent documents</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/documents">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No documents yet. Upload your first file to get started.
              </div>
            ) : (
              documents.items.map((doc) => (
                <Link
                  key={doc._id.toString()}
                  href={`/app/documents/${doc._id.toString()}`}
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-tertiary text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatBytes(doc.size)} · {timeAgo(doc.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly usage</CardTitle>
            <CardDescription>
              {usage.plan} plan · {usage.aiRequests.toLocaleString()} / {usage.limits.aiRequestsPerMonth.toLocaleString()} AI questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">AI questions</span>
                <span>{usage.aiPercent}%</span>
              </div>
              <Progress value={usage.aiPercent} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Documents</span>
                <span>{usage.documentPercent}%</span>
              </div>
              <Progress value={usage.documentPercent} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Storage</span>
                <span>{usage.storagePercent}%</span>
              </div>
              <Progress value={usage.storagePercent} />
            </div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/app/billing">Manage plan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Organize your documents into logical groups</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {projects.map((project) => (
              <Link
                key={project._id.toString()}
                href={`/app/projects/${project._id.toString()}`}
              >
                <Badge variant="secondary" className="px-3 py-1 text-sm">
                  {project.name}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "READY" ? "success" : status === "FAILED" ? "destructive" : "warning";
  return <Badge variant={variant}>{status}</Badge>;
}
