import "server-only";
import { createNotification } from "@/services/notificationService";
import type { NotificationJobData } from "@/lib/queue/queue";

export async function processNotificationJob(data: NotificationJobData): Promise<void> {
  await createNotification({
    workspaceId: data.workspaceId,
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    data: data.data,
  });
}
