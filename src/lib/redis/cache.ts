import "server-only";
import { getRedis } from "@/lib/redis/redis";

/**
 * Tenant-aware Redis cache helpers. Cache keys MUST include the tenant
 * context (workspaceId) to prevent cross-tenant data leakage.
 */

const CACHE_TTL = 60 * 5; // 5 minutes default

export interface CacheOptions {
  ttl?: number;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  opts: CacheOptions = {},
): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(value), "EX", opts.ttl ?? CACHE_TTL);
  } catch {
    // Cache failures must never break the request path.
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await getRedis().del(...keys);
  } catch {
    // noop
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // noop
  }
}

export function workspaceCacheKey(workspaceId: string, suffix: string): string {
  return `workspace:${workspaceId}:${suffix}`;
}

export async function getOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  opts: CacheOptions = {},
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = await factory();
  await cacheSet(key, value, opts);
  return value;
}
