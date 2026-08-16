"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FolderKanban,
  FileText,
  MessageSquare,
  HardDrive,
  MessageCircleQuestion,
  ChevronLeft,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { actionGetProject, actionGetProjectStats } from "@/actions/project";
import { actionListDocuments } from "@/actions/document";
import { formatBytes } from "@/lib/utils";

const COLOR_TO_CLASS: Record<string, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
};

export function ProjectDetailClient() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", workspaceId, projectId],
    queryFn: () =>
      actionGetProject(workspaceId, projectId).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data;
      }),
    enabled: Boolean(workspaceId) && Boolean(projectId),
  });

  const { data: stats } = useQuery({
    queryKey: ["project-stats", workspaceId, projectId],
    queryFn: () =>
      actionGetProjectStats(workspaceId, projectId).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data;
      }),
    enabled: Boolean(workspaceId) && Boolean(projectId),
  });

  const { data: docs } = useQuery({
    queryKey: ["project-docs", workspaceId, projectId],
    queryFn: () =>
      actionListDocuments(workspaceId, { projectId, limit: 20 }).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data;
      }),
    enabled: Boolean(workspaceId) && Boolean(projectId),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-8">
        <Skeleton className="h-12 w-1/2" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const statCards = [
    { label: "Documents", value: String(stats?.documents ?? 0), icon: FileText },
    { label: "Ready", value: String(stats?.readyDocuments ?? 0), icon: FileText },
    { label: "Conversations", value: String(stats?.conversations ?? 0), icon: MessageSquare },
    { label: "AI questions", value: String(stats?.aiQuestions ?? 0), icon: MessageCircleQuestion },
    { label: "Storage", value: formatBytes(stats?.storageBytes ?? 0), icon: HardDrive },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/app/projects")}>
        <ChevronLeft className="h-4 w-4" /> Back to projects
      </Button>

      <div className="flex items-start gap-3">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${COLOR_TO_CLASS[project.color] ?? "bg-indigo-500"} text-white`}
        >
          <FolderKanban className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.description || "No description"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">{value}</p>
                <p className="truncate text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Documents in this project</CardTitle>
            <CardDescription>
              {docs?.items.length ?? 0} document{(docs?.items.length ?? 0) === 1 ? "" : "s"}
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/app/documents">Manage documents</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs && docs.items.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No documents in this project yet. Assign documents from the Documents page.
            </div>
          )}
          {docs?.items.map((doc) => (
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
                <p className="text-xs text-muted-foreground">{formatBytes(doc.size)}</p>
              </div>
              <Badge variant={doc.status === "READY" ? "success" : doc.status === "FAILED" ? "destructive" : "warning"}>
                {doc.status}
              </Badge>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Button asChild className="w-full">
        <Link href={`/app/chat`}>Ask about this project in Chat</Link>
      </Button>
    </div>
  );
}
