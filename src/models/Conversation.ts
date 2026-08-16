import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const conversationSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, default: "New conversation", maxlength: 200 },
    pinned: { type: Boolean, default: false },
    messagesCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true },
);

conversationSchema.index({ workspaceId: 1, userId: 1, updatedAt: -1 });
conversationSchema.index({ workspaceId: 1, userId: 1, pinned: 1 });

export type Conversation = InferSchemaType<typeof conversationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ConversationModel =
  (mongoose.models.Conversation as mongoose.Model<Conversation>) ??
  mongoose.model<Conversation>("Conversation", conversationSchema);
