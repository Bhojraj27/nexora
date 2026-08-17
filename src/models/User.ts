import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    passwordHash: { type: String, required: true },
    avatarUrl: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    verificationTokenExpiresAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpiresAt: { type: Date, default: null },
    onboardingPurpose: { type: String, default: null },
    onboardingCompleted: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const UserModel =
  (mongoose.models.User as mongoose.Model<User>) ??
  mongoose.model<User>("User", userSchema);
