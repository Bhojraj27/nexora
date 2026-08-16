import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const DOCUMENT_STATUSES = [
  "UPLOADING",
  "PROCESSING",
  "EXTRACTING",
  "INDEXING",
  "READY",
  "FAILED",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt", "md", "csv"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

const documentSchema = new Schema(
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
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    extension: {
      type: String,
      enum: SUPPORTED_EXTENSIONS,
      required: true,
      lowercase: true,
    },
    size: { type: Number, required: true, min: 0 },
    storageKey: { type: String, required: true },
    textKey: { type: String, default: null },
    status: {
      type: String,
      enum: DOCUMENT_STATUSES,
      default: "UPLOADING",
      index: true,
    },
    error: { type: String, default: null },
    chunkCount: { type: Number, default: 0 },
    pageCount: { type: Number, default: 0 },
    checksum: { type: String, default: null },
    tags: { type: [String], default: [] },
    favorite: { type: Boolean, default: false },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

documentSchema.index({ workspaceId: 1, createdAt: -1 });
documentSchema.index({ workspaceId: 1, status: 1 });
documentSchema.index({ workspaceId: 1, favorite: 1 });
documentSchema.index({ projectId: 1, createdAt: -1 });
documentSchema.index({ workspaceId: 1, uploadedBy: 1 });

export type Document = InferSchemaType<typeof documentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DocumentModel =
  (mongoose.models.Document as mongoose.Model<Document>) ??
  mongoose.model<Document>("Document", documentSchema);
