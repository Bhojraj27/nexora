import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { listMembers } from "@/services/teamService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    await requirePermission("workspace:read", workspaceId);
    const { members, pendingInvites } = await listMembers(workspaceId);
    return NextResponse.json({ members, pendingInvites });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load team";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
