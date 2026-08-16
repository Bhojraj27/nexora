import "server-only";

export interface StoredFile {
  key: string;
  size: number;
  contentType: string;
}

export interface StorageProvider {
  readonly name: string;
  save(buffer: Buffer, key: string, contentType: string): Promise<StoredFile>;
  get(key: string): Promise<Buffer | null>;
  getStream(key: string): Promise<NodeJS.ReadableStream | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getDownloadUrl?(key: string): Promise<string>;
}

export function safeStorageKey(parts: string[]): string {
  return parts
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "").replace(/\.\./g, ""))
    .filter(Boolean)
    .join("/");
}
