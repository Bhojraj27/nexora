import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const usageSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    month: { type: String, required: true }, // "YYYY-MM"
    documents: { type: Number, default: 0 },
    storageBytes: { type: Number, default: 0 },
    aiRequests: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    estCostUsd: { type: Number, default: 0 },
    activeMembers: { type: Number, default: 0 },
  },
  { timestamps: true },
);

usageSchema.index({ workspaceId: 1, month: 1 }, { unique: true });

export type Usage = InferSchemaType<typeof usageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const UsageModel =
  (mongoose.models.Usage as mongoose.Model<Usage>) ??
  mongoose.model<Usage>("Usage", usageSchema);
