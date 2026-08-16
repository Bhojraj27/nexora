import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const documentChunkSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
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
    index: { type: Number, required: true },
    text: { type: String, required: true },
    pageNumber: { type: Number, default: 1 },
    tokenCount: { type: Number, default: 0 },
    contentHash: { type: String, default: null },
    embedding: { type: [Number], default: [] },
  },
  { timestamps: true },
);

documentChunkSchema.index({ workspaceId: 1, documentId: 1, index: 1 });
documentChunkSchema.index({ documentId: 1 });

export type DocumentChunk = InferSchemaType<typeof documentChunkSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DocumentChunkModel =
  (mongoose.models.DocumentChunk as mongoose.Model<DocumentChunk>) ??
  mongoose.model<DocumentChunk>("DocumentChunk", documentChunkSchema);
