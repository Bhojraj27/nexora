import type { Metadata } from "next";
import { CreateWorkspaceClient } from "@/components/workspace/create-workspace-client";

export const metadata: Metadata = {
  title: "Create workspace",
  description: "Create a new NEXORA workspace",
};

export default function CreateWorkspacePage() {
  return <CreateWorkspaceClient />;
}
