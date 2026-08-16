import "server-only";
import { getRedis } from "@/lib/redis/redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Redis. Every namespace is limited
 * separately (auth, ai, upload, search). AI has the strictest limits.
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = `rl:${identifier}`;
  const redis = getRedis();
  try {
    const result = await redis
      .multi()
      .incr(key)
      .pexpire(key, windowSeconds * 1000)
      .exec();

    const count = Number(result?.[0]?.[1] ?? 1);
    const success = count <= limit;
    return {
      success,
      limit,
      remaining: Math.max(0, limit - count),
      resetInSeconds: windowSeconds,
    };
  } catch {
    // Fail open if Redis is unavailable so the app stays usable.
    return { success: true, limit, remaining: limit, resetInSeconds: windowSeconds };
  }
}

export function keyFor(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts].join(":");
}
