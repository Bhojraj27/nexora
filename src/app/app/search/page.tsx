import type { Metadata } from "next";
import { SearchClient } from "@/components/search/search-client";

export const metadata: Metadata = {
  title: "Search",
  description: "Search your knowledge base",
};

export default function SearchPage() {
  return <SearchClient />;
}
