import { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis/redis";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(message: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(message)}\n\n`);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.sub;
  const channel = `notify:${userId}`;

  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const client = getRedis().duplicate();

      const onMessage = (_ch: string, payload: string) => {
        try {
          controller.enqueue(sse(JSON.parse(payload)));
        } catch {
          // ignore malformed payloads
        }
      };

      client.on("message", onMessage);
      await client.subscribe(channel);

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {
          // stream closed
        }
      }, 25_000);

      abortController.signal.addEventListener("abort", async () => {
        clearInterval(keepAlive);
        try {
          await client.unsubscribe(channel);
          client.disconnect();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
