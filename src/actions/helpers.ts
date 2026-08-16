import { AppError } from "@/lib/errors";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(message: string): ActionResult<never> {
  return { ok: false, error: message };
}

export function toActionError(err: unknown, fallback = "Something went wrong."): ActionResult<never> {
  if (err instanceof AppError) {
    return fail(err.message);
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail(first ? `${first.path.join(".")}: ${first.message}` : "Invalid input.");
  }
  if (err instanceof Error) {
    logger.error("action failed", { error: err.message });
    return fail(err.message || fallback);
  }
  return fail(fallback);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Converts a value into a plain, JSON-safe structure so it can cross the
 * server-action boundary. Mongoose lean documents contain non-plain values
 * (ObjectId, Buffer, Decimal128) which Next.js refuses to serialize.
 */
export function toSerializable<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return value as unknown as T;
  }
  if (typeof (value as { toJSON?: unknown }).toJSON === "function") {
    return toSerializable(((value as unknown as { toJSON: () => unknown }).toJSON)()) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      out[key] = toSerializable((value as Record<string, unknown>)[key]);
    }
    return out as unknown as T;
  }
  return String(value) as unknown as T;
}

export async function runAction<T>(
  fn: () => Promise<T>,
  fallback?: string,
): Promise<ActionResult<T extends undefined | void ? undefined : T>> {
  try {
    const data = await fn();
    return ok(toSerializable(data) as T extends undefined | void ? undefined : T);
  } catch (err) {
    return toActionError(err, fallback);
  }
}
