import type { Metadata } from "next";
import { DocumentDetailClient } from "@/components/documents/document-detail-client";

export const metadata: Metadata = {
  title: "Document",
  description: "Document details",
};

export default function DocumentDetailPage() {
  return <DocumentDetailClient />;
}
