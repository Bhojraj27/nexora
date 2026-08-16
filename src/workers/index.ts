import { Worker } from "bullmq";
import { getRedis } from "@/lib/redis/redis";
import { config } from "@/lib/config";
import { connectDB } from "@/lib/db/mongoose";
import { QUEUE_NAMES } from "@/lib/queue/queue";
import { processDocumentJob } from "@/workers/jobs/documentProcessor";
import { processNotificationJob } from "@/workers/jobs/notificationJob";
import { logger } from "@/lib/logger";
import "../models";

async function main() {
  await connectDB();
  const connection = getRedis();

  const documentWorker = new Worker(
    QUEUE_NAMES.documentProcessing,
    async (job) => {
      return processDocumentJob(job.data as { documentId: string; workspaceId: string });
    },
    {
      connection,
      prefix: config.redisQueuePrefix,
      concurrency: 2,
      limiter: { max: 10, duration: 1000 },
    },
  );

  const notificationWorker = new Worker(
    QUEUE_NAMES.notifications,
    async (job) => {
      return processNotificationJob(job.data);
    },
    {
      connection,
      prefix: config.redisQueuePrefix,
      concurrency: 10,
    },
  );

  documentWorker.on("completed", (job) => {
    logger.info("worker job completed", { queue: "document-processing", id: job.id });
  });
  documentWorker.on("failed", (job, err) => {
    logger.error("worker job failed", {
      queue: "document-processing",
      id: job?.id,
      error: err.message,
    });
  });
  notificationWorker.on("failed", (job, err) => {
    logger.error("worker job failed", {
      queue: "notifications",
      id: job?.id,
      error: err.message,
    });
  });

  logger.info("nexora worker started", {
    documentProcessing: true,
    notifications: true,
    provider: config.aiProvider,
    storage: config.storageProvider,
    vectorSearch: config.vectorSearchProvider,
  });
}

main().catch((err) => {
  logger.error("worker failed to start", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
