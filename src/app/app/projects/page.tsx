import type { Metadata } from "next";
import { ProjectsClient } from "@/components/projects/projects-client";

export const metadata: Metadata = {
  title: "Projects",
  description: "Organize your NEXORA projects",
};

export default function ProjectsPage() {
  return <ProjectsClient />;
}
