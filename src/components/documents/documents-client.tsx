"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  FileText,
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-context";
import { UploadDocument } from "@/components/documents/upload-document";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  actionListDocuments,
  actionRenameDocument,
  actionUpdateDocumentMeta,
  actionDeleteDocument,
} from "@/actions/document";
import { formatBytes, timeAgo } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  READY: "success",
  UPLOADING: "secondary",
  EXTRACTING: "warning",
  INDEXING: "warning",
  FAILED: "destructive",
};

export function DocumentsClient() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["documents", workspaceId, search],
    queryFn: () =>
      actionListDocuments(workspaceId, { search: search || undefined, limit: 50 }).then(
        (r) => {
          if (!r.ok) throw new Error(r.error);
          return r.data;
        },
      ),
    enabled: Boolean(workspaceId),
  });

  const docs = useMemo(() => data?.items ?? [], [data]);

  async function toggleFavorite(id: string, current: boolean) {
    const res = await actionUpdateDocumentMeta(workspaceId, id, { favorite: !current });
    if (res.ok) refetch();
    else toast.error(res.error);
  }

  async function submitRename() {
    if (!renaming) return;
    const res = await actionRenameDocument(workspaceId, renaming.id, { name: renameValue.trim() });
    if (res.ok) {
      toast.success("Document renamed");
      setRenaming(null);
      refetch();
    } else {
      toast.error(res.error);
    }
  }

  async function removeDocument(id: string) {
    const res = await actionDeleteDocument(workspaceId, id);
    if (res.ok) toast.success("Document deleted");
    else toast.error(res.error);
    refetch();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Upload files and NEXORA indexes them for AI-powered search.
          </p>
        </div>
      </div>

      <UploadDocument workspaceId={workspaceId} />

      <div className="space-y-4">
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        <Card>
          <CardHeader>
            <CardTitle>All documents</CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading..."
                : `${docs.length} document${docs.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-9 w-9" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}

            {!isLoading && docs.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {search ? "No documents match your search." : "No documents yet. Upload your first file above."}
              </div>
            )}

            {docs.map((doc) => (
              <div
                key={doc._id.toString()}
                className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary"
              >
                <Link
                  href={`/app/documents/${doc._id.toString()}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-tertiary text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatBytes(doc.size)} · {timeAgo(doc.createdAt)}
                      {doc.projectId &&
                        ` · ${(doc.projectId as unknown as { name: string }).name}`}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[doc.status] ?? "secondary"}>
                    {doc.status}
                  </Badge>
                </Link>

                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleFavorite(doc._id.toString(), doc.favorite)}
                    aria-label={doc.favorite ? "Unfavorite" : "Favorite"}
                  >
                    <Star
                      className={`h-4 w-4 ${doc.favorite ? "fill-yellow-400 text-yellow-400" : ""}`}
                    />
                  </Button>
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                    <a
                      href={`/api/documents/${doc._id.toString()}/download`}
                      aria-label="Download"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenaming({ id: doc._id.toString(), name: doc.name });
                          setRenameValue(doc.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => removeDocument(doc._id.toString())}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(renaming)} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={!renameValue.trim()}>
              {false && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
