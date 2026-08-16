"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Send,
  Loader2,
  Trash2,
  Pin,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-context";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  actionListConversations,
  actionCreateConversation,
  actionGetConversation,
  actionDeleteConversation,
} from "@/actions/conversation";
import { timeAgo } from "@/lib/utils";

interface StreamMessage {
  type: "sources" | "delta" | "done" | "error";
  sources?: Array<{ documentName?: string; documentId?: string; chunkText?: string; score?: number }>;
  text?: string;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: StreamMessage["sources"];
  pending?: boolean;
}

export function ChatClient() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const activeId = searchParams.get("c");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentConvoId, setCurrentConvoId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations, isLoading: convosLoading } = useQuery({
    queryKey: ["conversations", workspaceId],
    queryFn: () =>
      actionListConversations(workspaceId).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data;
      }),
    enabled: Boolean(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: () => actionCreateConversation(workspaceId, {}),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
        router.push(`/app/chat?c=${r.data.conversationId}`);
        setCurrentConvoId(r.data.conversationId);
        setMessages([]);
        setInput("");
        textareaRef.current?.focus();
      } else {
        toast.error(r.error);
      }
    },
  });

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setCurrentConvoId(null);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    actionGetConversation(workspaceId, activeId)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setCurrentConvoId(activeId);
          setMessages(
            r.data.messages
              .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
              .map((m: { _id: { toString: () => string }; role: string; content: string; sources?: StreamMessage["sources"] }) => ({
                id: m._id.toString(),
                role: m.role as "user" | "assistant",
                content: m.content,
                sources: m.sources ?? [],
              })),
          );
        }
      })
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, [activeId, workspaceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function sendQuestion() {
    const question = input.trim();
    if (!question || streaming) return;

    let convoId = currentConvoId;
    if (!convoId) {
      const created = await actionCreateConversation(workspaceId, { question });
      if (!created.ok) {
        toast.error(created.error);
        return;
      }
      convoId = created.data.conversationId;
      setCurrentConvoId(convoId);
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
      router.replace(`/app/chat?c=${convoId}`, { scroll: false });
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    const pendingAssistant: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      pending: true,
    };

    setMessages((prev) => [...prev, userMessage, pendingAssistant]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, conversationId: convoId, question }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to get a response");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let sources: StreamMessage["sources"] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const lines = acc.split("\n");
        acc = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let msg: StreamMessage;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.type === "sources" && msg.sources) {
            sources = msg.sources;
            setMessages((prev) =>
              prev.map((m) => (m.id === pendingAssistant.id ? { ...m, sources } : m)),
            );
          } else if (msg.type === "delta" && typeof msg.text === "string") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingAssistant.id ? { ...m, content: m.content + msg.text } : m,
              ),
            );
          } else if (msg.type === "done") {
            break;
          } else if (msg.type === "error") {
            throw new Error(msg.error ?? "Streaming error");
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingAssistant.id
            ? { ...m, content: err instanceof Error ? `⚠ ${err.message}` : "Something went wrong", pending: false }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingAssistant.id ? { ...m, pending: false } : m)),
      );
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
    }
  }

  async function removeConversation(id: string) {
    const res = await actionDeleteConversation(workspaceId, id);
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
      if (id === currentConvoId) {
        router.replace("/app/chat", { scroll: false });
        setMessages([]);
        setCurrentConvoId(null);
      }
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border md:flex">
        <div className="border-b border-border p-3">
          <Button
            className="w-full justify-start gap-2"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Plus className="h-4 w-4" /> New conversation
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-2">
            {convosLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            {(conversations ?? []).map((convo) => (
              <div
                key={convo._id.toString()}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                  activeId === convo._id.toString()
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-secondary",
                )}
                onClick={() => router.push(`/app/chat?c=${convo._id.toString()}`)}
              >
                <Pin
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    convo.pinned ? "fill-primary text-primary" : "opacity-0",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{convo.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {timeAgo(convo.lastMessageAt ?? convo.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-secondary hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeConversation(convo._id.toString());
                  }}
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 lg:p-6">
            {messages.length === 0 && !loadingHistory && (
              <div className="flex flex-col items-center gap-3 py-24 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" />
                </span>
                <h2 className="text-xl font-semibold">Ask anything about your documents</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  NEXORA searches your uploaded files and answers with sources.
                </p>
              </div>
            )}

            {loadingHistory && (
              <div className="space-y-4 pt-10">
                <Skeleton className="h-16 w-2/3" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-2",
                  msg.role === "user" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface",
                  )}
                >
                  {msg.role === "assistant" && msg.content === "" ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                    </div>
                  ) : msg.role === "assistant" ? (
                    <Markdown content={msg.content} size="xs" />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div className="flex max-w-[85%] flex-wrap gap-1.5">
                    {msg.sources.slice(0, 5).map((src, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="max-w-full gap-1 px-2 py-0.5 text-xs"
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {src.documentName ?? "Source"}
                          {typeof src.score === "number" && ` · ${Math.round(src.score * 100)}%`}
                        </span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendQuestion();
                }
              }}
              placeholder="Ask a question about your documents…"
              rows={1}
              className="max-h-40 min-h-12 flex-1 resize-none"
            />
            <Button
              onClick={sendQuestion}
              disabled={!input.trim() || streaming}
              size="icon"
              className="h-12 w-12 shrink-0"
              aria-label="Send message"
            >
              {streaming ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
