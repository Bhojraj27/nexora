import { NextResponse } from "next/server";
import { connectDB, pingDB } from "@/lib/db/mongoose";
import { getRedis } from "@/lib/redis/redis";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await connectDB();
    await pingDB();
    checks.mongodb = "ok";
  } catch {
    checks.mongodb = "error";
  }

  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  const healthy = Object.values(checks).every((c) => c === "ok");
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: "1.0.0",
      environment: config.nodeEnv,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
