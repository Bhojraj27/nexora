import "server-only";
import Redis from "ioredis";
import { config } from "@/lib/config";
import { logger } from "@/lib/logger";

/**
 * Redis is used for:
 *  1. BullMQ (document-processing background jobs)
 *  2. Rate limiting (auth, AI, upload, search)
 *  3. Read-heavy cache (workspace metadata, analytics)
 *  4. Temporary state (upload sessions, notification fan-out)
 */

const globalForRedis = globalThis as unknown as {
  redisClient?: Redis;
};

function createClient(): Redis {
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  client.on("error", (err) => {
    logger.warn("redis error", { error: err.message });
  });

  client.on("connect", () => {
    logger.info("redis connected");
  });

  return client;
}

export function getRedis(): Redis {
  if (!globalForRedis.redisClient) {
    globalForRedis.redisClient = createClient();
  }
  return globalForRedis.redisClient;
}

export async function pingRedis(): Promise<boolean> {
  try {
    await getRedis().ping();
    return true;
  } catch {
    return false;
  }
}
