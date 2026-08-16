import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { ROLES, type Role } from "@/lib/permissions";

const workspaceMemberSchema = new Schema(
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
    role: { type: String, enum: ROLES, required: true, default: "MEMBER" },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceMemberSchema.index({ userId: 1, workspaceId: 1 });

export type WorkspaceMember = InferSchemaType<typeof workspaceMemberSchema> & {
  _id: mongoose.Types.ObjectId;
  role: Role;
};

export const WorkspaceMemberModel =
  (mongoose.models.WorkspaceMember as mongoose.Model<WorkspaceMember>) ??
  mongoose.model<WorkspaceMember>("WorkspaceMember", workspaceMemberSchema);
