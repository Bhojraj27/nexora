import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const NOTIFICATION_TYPES = [
  "document_processed",
  "document_failed",
  "member_invited",
  "role_changed",
  "usage_warning",
  "new_comment",
  "system",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: "" },
    data: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ workspaceId: 1, createdAt: -1 });

export type Notification = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const NotificationModel =
  (mongoose.models.Notification as mongoose.Model<Notification>) ??
  mongoose.model<Notification>("Notification", notificationSchema);
