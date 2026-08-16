import "server-only";
import { Queue } from "bullmq";
import { getRedis } from "@/lib/redis/redis";
import { config } from "@/lib/config";

export const QUEUE_NAMES = {
  documentProcessing: "document-processing",
  notifications: "notifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const globalForQueues = globalThis as unknown as {
  queues?: Partial<Record<QueueName, Queue>>;
};

function createQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: getRedis(),
    prefix: config.redisQueuePrefix,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 60 * 60 * 24, count: 200 },
      removeOnFail: { age: 60 * 60 * 24 * 3, count: 500 },
    },
  });
}

export function getQueue(name: QueueName): Queue {
  if (!globalForQueues.queues) globalForQueues.queues = {};
  if (!globalForQueues.queues[name]) {
    globalForQueues.queues[name] = createQueue(name);
  }
  return globalForQueues.queues[name]!;
}

export async function enqueueDocumentProcessing(
  documentId: string,
  workspaceId: string,
): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.documentProcessing);
  const job = await queue.add(
    "process-document",
    { documentId, workspaceId },
    { jobId: `doc-${documentId}`, attempts: 3 },
  );
  return job.id ?? "";
}

export interface NotificationJobData {
  workspaceId: string;
  userId: string;
  type: "document_processed" | "document_failed" | "member_invited" | "role_changed" | "usage_warning" | "new_comment" | "system";
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.notifications);
  await queue.add("send-notification", data);
}
