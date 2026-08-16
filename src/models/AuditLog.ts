import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const auditLogSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, default: "" },
    action: { type: String, required: true, maxlength: 120 },
    entityType: { type: String, default: "" },
    entityId: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
  },
  { timestamps: true },
);

auditLogSchema.index({ workspaceId: 1, createdAt: -1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AuditLogModel =
  (mongoose.models.AuditLog as mongoose.Model<AuditLog>) ??
  mongoose.model<AuditLog>("AuditLog", auditLogSchema);
