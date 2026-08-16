import type { Metadata } from "next";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";

export const metadata: Metadata = {
  title: "Project",
  description: "Project details",
};

export default function ProjectDetailPage() {
  return <ProjectDetailClient />;
}
