import "server-only";
import { config } from "@/lib/config";

type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: Level): boolean {
  const threshold =
    config.nodeEnv === "production" ? LOG_LEVELS.info : LOG_LEVELS.debug;
  return LOG_LEVELS[level] >= threshold;
}

function sanitize(fields: LogFields): LogFields {
  const redactedKeys = new Set([
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "apiKey",
    "api_key",
    "key",
  ]);
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (redactedKeys.has(key.toLowerCase())) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

function write(level: Level, message: string, fields?: LogFields) {
  if (!shouldLog(level)) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...sanitize(fields ?? {}),
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
