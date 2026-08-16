import "server-only";
import { config } from "@/lib/config";
import { LocalStorageProvider } from "@/lib/storage/localStorage";
import { S3StorageProvider } from "@/lib/storage/s3Storage";
import type { StorageProvider } from "@/lib/storage/types";

const globalForStorage = globalThis as unknown as {
  storageProvider?: StorageProvider;
};

export function getStorage(): StorageProvider {
  if (globalForStorage.storageProvider) return globalForStorage.storageProvider;

  const provider =
    config.storageProvider === "s3" ? new S3StorageProvider() : new LocalStorageProvider();
  globalForStorage.storageProvider = provider;
  return provider;
}

export type { StorageProvider, StoredFile } from "@/lib/storage/types";
