import type { Metadata } from "next";
import { AnalyticsClient } from "@/components/analytics/analytics-client";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Workspace analytics",
};

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
