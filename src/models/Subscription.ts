import "server-only";
import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { PLAN_TYPES, type PlanType } from "@/models/Workspace";

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const subscriptionSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    provider: { type: String, default: "mock" },
    plan: { type: String, enum: PLAN_TYPES, required: true },
    providerCustomerId: { type: String, default: null },
    providerSubscriptionId: { type: String, default: null },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: "active",
    },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

subscriptionSchema.index({ workspaceId: 1 }, { unique: true });

export type Subscription = InferSchemaType<typeof subscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
  plan: PlanType;
};

export const SubscriptionModel =
  (mongoose.models.Subscription as mongoose.Model<Subscription>) ??
  mongoose.model<Subscription>("Subscription", subscriptionSchema);
