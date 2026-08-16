import type { Metadata } from "next";
import { BillingClient } from "@/components/billing/billing-client";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage your plan",
};

export default function BillingPage() {
  return <BillingClient />;
}
