import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatClient } from "@/components/chat/chat-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Chat",
  description: "Chat with your documents",
};

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Skeleton className="h-8 w-64" />
          </div>
        }
      >
        <ChatClient />
      </Suspense>
    </div>
  );
}
