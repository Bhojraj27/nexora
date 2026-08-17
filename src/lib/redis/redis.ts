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
  redisErrorLoggedAt?: number;
};

const ERROR_LOG_INTERVAL_MS = 30_000;

function createClient(): Redis {
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
  });

  client.on("error", (err) => {
    const now = Date.now();
    const lastLogged = globalForRedis.redisErrorLoggedAt ?? 0;
    if (now - lastLogged < ERROR_LOG_INTERVAL_MS) return;

    globalForRedis.redisErrorLoggedAt = now;
    logger.warn("redis unavailable — cache and rate limits will use fallbacks", {
      error: err.message || "connection refused",
    });
  });

  client.on("connect", () => {
    globalForRedis.redisErrorLoggedAt = undefined;
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
    const redis = getRedis();
    if (redis.status === "wait") {
      await redis.connect();
    }
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
