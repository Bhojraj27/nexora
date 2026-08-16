import type { Metadata } from "next";
import { DocumentsClient } from "@/components/documents/documents-client";

export const metadata: Metadata = {
  title: "Documents",
  description: "Manage your NEXORA documents",
};

export default function DocumentsPage() {
  return <DocumentsClient />;
}
