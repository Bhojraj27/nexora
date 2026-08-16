import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export interface MessageSource {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber?: number;
  excerpt: string;
}

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    role: { type: String, enum: MESSAGE_ROLES, required: true },
    content: { type: String, required: true },
    sources: {
      type: [
        new Schema(
          {
            documentId: { type: String },
            documentName: { type: String },
            chunkIndex: { type: Number },
            pageNumber: { type: Number },
            excerpt: { type: String },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    tokens: {
      type: new Schema(
        {
          input: { type: Number, default: 0 },
          output: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: () => ({ input: 0, output: 0 }),
    },
    feedback: { type: String, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export type Message = InferSchemaType<typeof messageSchema> & {
  _id: mongoose.Types.ObjectId;
  sources: MessageSource[];
};

export const MessageModel =
  (mongoose.models.Message as mongoose.Model<Message>) ??
  mongoose.model<Message>("Message", messageSchema);
