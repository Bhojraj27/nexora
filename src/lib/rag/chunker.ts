import "server-only";
import { createHash } from "node:crypto";

export interface Chunk {
  index: number;
  text: string;
  pageNumber: number;
  tokenCount: number;
  contentHash: string;
}

const CHUNK_SIZE = 900; // approximate chars per chunk (≈200 tokens)
const CHUNK_OVERLAP = 120;
const MAX_CHUNKS = 2000;

function estimateTokens(text: string): number {
  // Rough heuristic: ~4.5 chars per token for English
  return Math.max(1, Math.ceil(text.length / 4.5));
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Splits extracted text into overlapping chunks. PDF page breaks (\f) are
 * preserved so each chunk can carry the page number it came from.
 */
export function chunkText(rawText: string): Chunk[] {
  const pages = rawText.split("\f");

  const pieces: { text: string; pageNumber: number }[] = [];
  pages.forEach((page, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const paragraphs = page.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const paragraph of paragraphs) {
      pieces.push({ text: paragraph, pageNumber });
    }
  });

  const chunks: Chunk[] = [];
  let current = "";
  let currentPage = 1;

  const pushChunk = (text: string, page: number) => {
    if (!text.trim()) return;
    if (chunks.length >= MAX_CHUNKS) return;
    chunks.push({
      index: chunks.length,
      text: text.trim(),
      pageNumber: page,
      tokenCount: estimateTokens(text),
      contentHash: hash(text),
    });
  };

  for (const piece of pieces) {
    if (current && current.length + piece.text.length + 2 > CHUNK_SIZE) {
      pushChunk(current, currentPage);
      // overlap: keep the tail of the previous chunk
      current = current.slice(-CHUNK_OVERLAP);
    }
    if (piece.text.length > CHUNK_SIZE * 1.5) {
      // Very long paragraph: hard-split
      const sentences = piece.text.match(/[^.!?]+[.!?]*\s*/g) ?? [piece.text];
      for (const sentence of sentences) {
        if (current && current.length + sentence.length > CHUNK_SIZE) {
          pushChunk(current, currentPage);
          current = current.slice(-CHUNK_OVERLAP);
        }
        current += sentence;
        currentPage = piece.pageNumber;
      }
    } else {
      current += (current ? "\n\n" : "") + piece.text;
      currentPage = piece.pageNumber;
    }
    if (current.length >= CHUNK_SIZE) {
      pushChunk(current, currentPage);
      current = "";
    }
  }

  if (current.trim()) {
    pushChunk(current, currentPage);
  }

  if (chunks.length === 0 && rawText.trim()) {
    chunks.push({
      index: 0,
      text: rawText.trim().slice(0, CHUNK_SIZE),
      pageNumber: 1,
      tokenCount: estimateTokens(rawText),
      contentHash: hash(rawText),
    });
  }

  return chunks;
}
