import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { safeStorageKey, type StorageProvider, type StoredFile } from "@/lib/storage/types";

const ROOT = path.join(process.cwd(), "storage-local");

function resolve(key: string): string {
  const resolved = path.resolve(ROOT, key);
  if (!resolved.startsWith(path.resolve(ROOT))) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";

  private ensureRoot() {
    fs.mkdirSync(ROOT, { recursive: true });
  }

  async save(buffer: Buffer, key: string, contentType: string): Promise<StoredFile> {
    this.ensureRoot();
    const cleanKey = safeStorageKey([key]);
    const filePath = resolve(cleanKey);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, buffer);
    return { key: cleanKey, size: buffer.length, contentType };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fsp.readFile(resolve(key));
    } catch {
      return null;
    }
  }

  async getStream(key: string): Promise<NodeJS.ReadableStream | null> {
    try {
      const filePath = resolve(key);
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) return null;
      return fs.createReadStream(filePath);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fsp.rm(resolve(key), { force: true });
    } catch {
      // ignore
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await fsp.stat(resolve(key))).isFile();
    } catch {
      return false;
    }
  }

  async getDownloadUrl(key: string): Promise<string> {
    return `/api/documents/file?key=${encodeURIComponent(key)}`;
  }

  static createReadable(buffer: Buffer): NodeJS.ReadableStream {
    return Readable.from(buffer);
  }
}
