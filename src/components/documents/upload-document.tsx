"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, Loader2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";

const MAX_SIZE = 25 * 1024 * 1024;
const ACCEPTED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/octet-stream",
];

interface PendingFile {
  file: File;
}

export function UploadDocument({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();

  function addFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > MAX_SIZE) {
        toast.error(`"${file.name}" exceeds the 25 MB upload limit`);
        continue;
      }
      if (!ACCEPTED.includes(file.type) && !file.type) {
        // allow octet-stream/unknown; processor validates by extension
      }
      setPending((prev) => [...prev, { file }]);
    }
  }

  async function uploadAll() {
    if (pending.length === 0 || uploading) return;
    setUploading(true);
    let ok = 0;
    for (const { file } of pending) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
        body: form,
      });
      if (res.ok) {
        ok++;
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? `Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    if (ok > 0) {
      toast.success(`${ok} document${ok > 1 ? "s" : ""} uploaded`);
      setPending([]);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border-strong hover:border-primary/50",
        )}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <div className="text-sm font-medium">Drop files here or click to browse</div>
        <div className="text-xs text-muted-foreground">
          PDF, DOCX, TXT, MD, CSV · up to 25 MB each
        </div>
      </button>

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map(({ file }, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => setPending([])}
            >
              Clear
            </Button>
            <Button size="sm" onClick={uploadAll} disabled={uploading}>
              {uploading && <Loader2 className="animate-spin" />}
              Upload {pending.length > 1 ? `(${pending.length})` : ""}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
