import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { globalSearch } from "@/services/searchService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    await requirePermission("document:read", workspaceId);
    if (q.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }
    const results = await globalSearch({
      workspaceId,
      query: q,
      projectId,
      limit: 20,
    });
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
