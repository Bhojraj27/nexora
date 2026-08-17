import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const PLAN_TYPES = ["free", "pro", "team"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, lowercase: true },
    logoUrl: { type: String, default: null },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: { type: String, enum: PLAN_TYPES, default: "free" },
    preferences: {
      type: new Schema(
        {
          defaultProjectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
          accentColor: { type: String, default: "indigo" },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: true },
);

workspaceSchema.index({ ownerId: 1 });
workspaceSchema.index({ slug: 1 }, { unique: true });

export type Workspace = InferSchemaType<typeof workspaceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WorkspaceModel =
  (mongoose.models.Workspace as mongoose.Model<Workspace>) ??
  mongoose.model<Workspace>("Workspace", workspaceSchema);
