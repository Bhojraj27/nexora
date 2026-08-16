import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { getUsageStatus } from "@/services/usageService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    await requirePermission("workspace:read", workspaceId);
    const usage = await getUsageStatus(workspaceId);
    return NextResponse.json({ usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
