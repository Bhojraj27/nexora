"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Star,
  Loader2,
  ListChecks,
  Lightbulb,
  ClipboardList,
  GraduationCap,
  MessageSquareText,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  actionGetDocument,
  actionGetDocumentText,
  actionGetDocumentChunks,
  actionUpdateDocumentMeta,
} from "@/actions/document";
import { formatBytes, formatDate } from "@/lib/utils";

type GenerateResult = {
  result?: string;
  summary?: string;
  key_points?: string[];
  action_items?: string[];
  quiz?: Array<Record<string, unknown>>;
  error?: string;
};

export function DocumentDetailClient() {
  const params = useParams<{ documentId: string }>();
  const documentId = params.documentId;
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;

  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [quiz, setQuiz] = useState<Array<Record<string, unknown>> | null>(null);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", workspaceId, documentId],
    queryFn: () =>
      actionGetDocument(workspaceId, documentId).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data;
      }),
    enabled: Boolean(workspaceId) && Boolean(documentId),
  });

  const { data: text, isLoading: textLoading } = useQuery({
    queryKey: ["document-text", workspaceId, documentId],
    queryFn: () =>
      actionGetDocumentText(workspaceId, documentId).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data;
      }),
    enabled: Boolean(workspaceId) && Boolean(documentId) && !!doc && doc.status === "READY",
  });

  const { data: chunks } = useQuery({
    queryKey: ["document-chunks", workspaceId, documentId],
    queryFn: () =>
      actionGetDocumentChunks(workspaceId, documentId).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data;
      }),
    enabled: Boolean(workspaceId) && Boolean(documentId) && !!doc && doc.status === "READY",
  });

  async function toggleFavorite() {
    if (!doc) return;
    const res = await actionUpdateDocumentMeta(workspaceId, documentId, {
      favorite: !doc.favorite,
    });
    if (res.ok) {
      if (doc.favorite) toast.success("Removed from favorites");
      else toast.success("Added to favorites");
    } else {
      toast.error(res.error);
    }
  }

  async function generate(action: "summary" | "key_points" | "action_items" | "quiz") {
    if (!doc || generating) return;
    setGenerating(action);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          workspaceId,
          documentId,
          quizConfig: action === "quiz" ? { count: 5, difficulty: "medium", type: "multiple_choice" } : undefined,
        }),
      });
      const json = (await res.json()) as GenerateResult;
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      if (action === "quiz" && Array.isArray(json.quiz)) {
        setQuiz(json.quiz);
      } else {
        const content =
          json.result ??
          json.summary ??
          (Array.isArray(json.key_points)
            ? json.key_points.map((p) => `- ${p}`).join("\n")
            : Array.isArray(json.action_items)
              ? json.action_items.map((p) => `- [ ] ${p}`).join("\n")
              : "");
        if (content) setGenerated((prev) => ({ ...prev, [action]: content }));
        else toast.error("No output generated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-8">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">Document not found.</p>
      </div>
    );
  }

  const ready = doc.status === "READY";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{doc.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatBytes(doc.size)} · {doc.extension.toUpperCase()} · uploaded {formatDate(doc.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleFavorite} aria-label="Toggle favorite">
            <Star className={`h-4 w-4 ${doc.favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/documents/${documentId}/download`}>
              <Download className="h-4 w-4" /> Download
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={doc.status === "READY" ? "success" : doc.status === "FAILED" ? "destructive" : "warning"}>
          {doc.status}
        </Badge>
        {doc.chunkCount > 0 && <Badge variant="secondary">{doc.chunkCount} chunks</Badge>}
        {doc.pageCount > 0 && <Badge variant="secondary">{doc.pageCount} pages</Badge>}
        {doc.tags?.map((tag: string) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>

      {doc.status === "FAILED" && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            {doc.error ?? "Processing failed. Re-upload the document to try again."}
          </CardContent>
        </Card>
      )}

      {ready && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => generate("summary")} disabled={!!generating}>
            {generating === "summary" ? <Loader2 className="animate-spin" /> : <ListChecks className="h-4 w-4" />}
            Summary
          </Button>
          <Button size="sm" variant="outline" onClick={() => generate("key_points")} disabled={!!generating}>
            {generating === "key_points" ? <Loader2 className="animate-spin" /> : <Lightbulb className="h-4 w-4" />}
            Key points
          </Button>
          <Button size="sm" variant="outline" onClick={() => generate("action_items")} disabled={!!generating}>
            {generating === "action_items" ? <Loader2 className="animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Action items
          </Button>
          <Button size="sm" variant="outline" onClick={() => generate("quiz")} disabled={!!generating}>
            {generating === "quiz" ? <Loader2 className="animate-spin" /> : <GraduationCap className="h-4 w-4" />}
            Quiz
          </Button>
        </div>
      )}

      {(generated.summary || generated.key_points || generated.action_items) && (
        <div className="space-y-4">
          {generated.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4" /> Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown content={generated.summary} />
              </CardContent>
            </Card>
          )}
          {generated.key_points && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="h-4 w-4" /> Key points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown content={generated.key_points} />
              </CardContent>
            </Card>
          )}
          {generated.action_items && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4" /> Action items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown content={generated.action_items} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {quiz && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4" /> Quiz
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quiz.map((q, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <p className="font-medium">
                  {i + 1}. {String(q.question ?? "")}
                </p>
                {Array.isArray(q.options) && (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {(q.options as string[]).map((opt, j) => (
                      <li key={j}>
                        {String.fromCharCode(65 + j)}. {opt}
                      </li>
                    ))}
                  </ul>
                )}
                {q.answer ? (
                  <p className="mt-2 text-sm text-primary">
                    Answer: {String(q.answer)}
                    {q.explanation ? ` — ${String(q.explanation)}` : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {ready && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="h-4 w-4" /> Content
            </CardTitle>
            <CardDescription>
              Extracted text{chunks ? ` · ${chunks.length} chunks shown` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="text">
              <TabsList>
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="chunks">Chunks</TabsTrigger>
              </TabsList>
              <TabsContent value="text">
                <ScrollArea className="h-[480px] rounded-md border border-border p-4">
                  {textLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {text || "No text extracted yet."}
                    </pre>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="chunks">
                <ScrollArea className="h-[480px] rounded-md border border-border p-4">
                  {chunks && chunks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No chunks.</p>
                  ) : (
                    <div className="space-y-4">
                      {chunks?.map((chunk) => (
                        <div key={chunk._id.toString()} className="rounded-md border border-border p-3">
                          <div className="mb-1 text-xs text-muted-foreground">
                            Chunk {chunk.index + 1}
                            {chunk.pageNumber ? ` · page ${chunk.pageNumber}` : ""}
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{chunk.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
