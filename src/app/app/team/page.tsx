import type { Metadata } from "next";
import { TeamClient } from "@/components/team/team-client";

export const metadata: Metadata = {
  title: "Team",
  description: "Manage your NEXORA team",
};

export default function TeamPage() {
  return <TeamClient />;
}
