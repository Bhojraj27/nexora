import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { getDashboardMetrics, getAnalyticsData } from "@/services/analyticsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    await requirePermission("analytics:read", workspaceId);
    const scope = request.nextUrl.searchParams.get("scope") ?? "dashboard";

    if (scope === "full") {
      const data = await getAnalyticsData(workspaceId);
      return NextResponse.json({ data });
    }

    const metrics = await getDashboardMetrics(workspaceId);
    return NextResponse.json({ metrics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
