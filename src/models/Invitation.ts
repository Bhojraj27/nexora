import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { ROLES, type Role } from "@/lib/permissions";

export const INVITATION_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

const invitationSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, enum: ROLES, required: true },
    token: { type: String, required: true, unique: true },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: INVITATION_STATUSES,
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

invitationSchema.index({ email: 1, status: 1 });

export type Invitation = InferSchemaType<typeof invitationSchema> & {
  _id: mongoose.Types.ObjectId;
  role: Role;
};

export const InvitationModel =
  (mongoose.models.Invitation as mongoose.Model<Invitation>) ??
  mongoose.model<Invitation>("Invitation", invitationSchema);
