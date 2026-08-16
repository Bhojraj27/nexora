import "server-only";

/**
 * Typed access to server-side configuration. All values default to safe
 * development values so the application can run with zero external setup.
 * Never expose these through NEXT_PUBLIC_* — they are server-only.
 */

function env(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

function envBool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

export const config = {
  appUrl: env("APP_URL", "http://localhost:3000"),
  port: Number(env("PORT", "3000")),
  nodeEnv: env("NODE_ENV", "development"),
  isProduction: env("NODE_ENV", "development") === "production",
  isTest: env("NODE_ENV", "development") === "test",

  mongodbUri: env(
    "MONGODB_URI",
    "mongodb://localhost:27017/nexora",
  ),

  redisUrl: env("REDIS_URL", "redis://localhost:6379"),
  redisQueuePrefix: env("REDIS_QUEUE_PREFIX", "nexora"),

  authSecret: env("AUTH_SECRET", "insecure-dev-secret-change-me"),
  authUrl: env("AUTH_URL", env("APP_URL", "http://localhost:3000")),

  aiProvider: env("AI_PROVIDER", "mock"),
  aiApiKey: env("AI_API_KEY"),
  aiModel: env("AI_MODEL", "gpt-4o-mini"),
  aiEmbeddingModel: env("AI_EMBEDDING_MODEL", "text-embedding-3-small"),
  aiMaxContextChars: Number(env("AI_MAX_CONTEXT_CHARS", "40000")),
  aiMaxOutputTokens: Number(env("AI_MAX_OUTPUT_TOKENS", "1500")),

  storageProvider: env("STORAGE_PROVIDER", "local"),
  storageBucket: env("STORAGE_BUCKET", "nexora"),
  storageAccessKey: env("STORAGE_ACCESS_KEY"),
  storageSecretKey: env("STORAGE_SECRET_KEY"),
  storageEndpoint: env("STORAGE_ENDPOINT"),
  storageRegion: env("STORAGE_REGION", "auto"),

  vectorSearchProvider: env("VECTOR_SEARCH_PROVIDER", "mock"),

  billingProvider: env("BILLING_PROVIDER", "mock"),
  billingSecretKey: env("BILLING_SECRET_KEY"),
  billingWebhookSecret: env("BILLING_WEBHOOK_SECRET"),

  emailProvider: env("EMAIL_PROVIDER", "mock"),
  smtpUrl: env("SMTP_URL"),

  demoEmail: env("DEMO_EMAIL", "demo@nexora.app"),
  demoPassword: env("DEMO_PASSWORD", "DemoPass123!"),

  enableSignups: envBool("ENABLE_SIGNUPS", true),
} as const;

export type AppConfig = typeof config;
