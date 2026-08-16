"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, FolderKanban, MessageSquare } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/utils";

interface SearchResponse {
  results: {
    documents: Array<{ id: string; name: string; type: string; status: string }>;
    projects: Array<{ id: string; name: string; description: string }>;
    conversations: Array<{ id: string; title: string; updatedAt: string }>;
    knowledge: Array<{ documentId: string; documentName: string; excerpt: string; pageNumber: number }>;
  };
}

export function SearchClient() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse["results"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?workspaceId=${workspaceId}&q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Search failed");
        const json = (await res.json()) as SearchResponse;
        setResults(json.results);
        setSearched(true);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  const total =
    (results?.documents.length ?? 0) +
    (results?.projects.length ?? 0) +
    (results?.conversations.length ?? 0) +
    (results?.knowledge.length ?? 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Search across documents, projects, conversations, and content.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your knowledge base…"
          className="pl-9 py-6 text-base"
        />
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {!loading && searched && query.trim().length >= 2 && total === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No results for &ldquo;{query}&rdquo;
        </p>
      )}

      {!loading && results && query.trim().length >= 2 && (
        <div className="space-y-6">
          {results.knowledge.length > 0 && (
            <Section title={`Content matches (${results.knowledge.length})`}>
              {results.knowledge.map((k, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => router.push(`/app/documents/${k.documentId}`)}
                  className="block w-full rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{k.documentName}</span>
                    {k.pageNumber > 0 && <span>· Page {k.pageNumber}</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{k.excerpt}</p>
                </button>
              ))}
            </Section>
          )}

          {results.documents.length > 0 && (
            <Section title={`Documents (${results.documents.length})`}>
              {results.documents.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => router.push(`/app/documents/${d.id}`)}
                  className="flex w-full items-center gap-3 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                  <span className="text-xs uppercase text-muted-foreground">{d.type}</span>
                </button>
              ))}
            </Section>
          )}

          {results.projects.length > 0 && (
            <Section title={`Projects (${results.projects.length})`}>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/app/projects/${p.id}`)}
                  className="flex w-full items-center gap-3 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong"
                >
                  <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                  </div>
                </button>
              ))}
            </Section>
          )}

          {results.conversations.length > 0 && (
            <Section title={`Conversations (${results.conversations.length})`}>
              {results.conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/app/chat?c=${c.id}`)}
                  className="flex w-full items-center gap-3 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.title}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.updatedAt)}</span>
                </button>
              ))}
            </Section>
          )}
        </div>
      )}

      {!loading && !searched && query.length > 0 && query.length < 2 && (
        <p className="text-center text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
