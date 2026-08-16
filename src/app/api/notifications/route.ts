import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/context";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
} from "@/services/notificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
    const onlyUnread = request.nextUrl.searchParams.get("unread") === "true";
    const items = await getNotifications(user._id.toString(), {
      limit: Math.min(Math.max(limit, 1), 100),
      onlyUnread,
    });
    const unreadCount = onlyUnread ? items.length : await getUnreadNotificationCount(user._id.toString());
    return NextResponse.json({ items, unreadCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const { notificationId, all } = body as { notificationId?: string; all?: boolean };

    if (all) {
      await markAllNotificationsRead(user._id.toString());
    } else if (notificationId) {
      await markNotificationRead(user._id.toString(), notificationId);
    } else {
      return NextResponse.json({ error: "notificationId or all is required" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update notifications";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
