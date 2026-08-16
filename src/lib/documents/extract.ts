import "server-only";
import { parse } from "csv-parse/sync";
import { extractRawText } from "mammoth";
import type { SupportedExtension } from "@/models/Document";
import { ValidationError } from "@/lib/errors";

export interface ExtractedText {
  text: string;
  pageCount: number;
}

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export function detectExtension(mimeType: string, filename: string): SupportedExtension | null {
  const fromName = filename.split(".").pop()?.toLowerCase() ?? "";
  const fromMime: Record<string, SupportedExtension> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",
    "application/csv": "csv",
  };

  const viaMime = fromMime[mimeType];
  if (viaMime && viaMime === fromName) return viaMime;

  // Fall back to a trusted extension allowlist, never blindly.
  if (["pdf", "docx", "txt", "md", "csv"].includes(fromName)) {
    return fromName as SupportedExtension;
  }
  return null;
}

export async function extractText(
  buffer: Buffer,
  extension: SupportedExtension,
): Promise<ExtractedText> {
  try {
    switch (extension) {
      case "pdf": {
        // Dynamic import keeps pdf-parse out of the main bundle path
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(buffer);
        return { text: parsed.text ?? "", pageCount: parsed.numpages ?? 1 };
      }      case "docx": {
        const result = await extractRawText({ buffer });
        return { text: result.value ?? "", pageCount: 1 };
      }
      case "txt":
      case "md": {
        return { text: buffer.toString("utf8"), pageCount: 1 };
      }
      case "csv": {
        const records = parse(buffer.toString("utf8"), {
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
        }) as Record<string, string>[];
        if (!records.length) return { text: "", pageCount: 1 };
        const headers = Object.keys(records[0]);
        const lines = records.map((rec) =>
          headers.map((h) => `${h}: ${rec[h] ?? ""}`).join("\n"),
        );
        return {
          text: `Headers: ${headers.join(", ")}\n\n${lines.join("\n\n")}`,
          pageCount: 1,
        };
      }
      default:
        throw new ValidationError("Unsupported file type");
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new Error(`Failed to extract text: ${err instanceof Error ? err.message : "unknown error"}`);
  }
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
