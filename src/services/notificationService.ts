import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { NotificationModel } from "@/models/Notification";
import { getRedis } from "@/lib/redis/redis";
import type { NotificationType } from "@/models/Notification";

/**
 * Creates a notification and publishes it to the user's SSE channel so the
 * client can update in real time without polling.
 */
export async function createNotification(input: {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  await connectDB();
  const doc = await NotificationModel.create({
    workspaceId: input.workspaceId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? "",
    data: input.data ?? {},
  });

  try {
    const redis = getRedis();
    const payload = JSON.stringify({
      id: doc._id.toString(),
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      workspaceId: input.workspaceId,
      createdAt: doc.createdAt,
    });
    await redis.publish(`notify:${input.userId.toString()}`, payload);
  } catch {
    // SSE publish is best-effort; the record is already saved.
  }
}

export async function getNotifications(
  userId: string,
  opts: { limit?: number; onlyUnread?: boolean } = {},
) {
  await connectDB();
  const filter: Record<string, unknown> = { userId };
  if (opts.onlyUnread) filter.read = false;
  return NotificationModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 50)
    .lean();
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  await connectDB();
  await NotificationModel.updateOne(
    { _id: notificationId, userId },
    { $set: { read: true, readAt: new Date() } },
  );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await connectDB();
  await NotificationModel.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  await connectDB();
  return NotificationModel.countDocuments({ userId, read: false });
}
