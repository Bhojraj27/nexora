import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/lib/config";
import { safeStorageKey, type StorageProvider, type StoredFile } from "@/lib/storage/types";

/**
 * S3-compatible storage (AWS S3, MinIO, R2, etc.). Used in production.
 * Development uses LocalStorageProvider.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";

  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = config.storageBucket;
    this.client = new S3Client({
      region: config.storageRegion,
      endpoint: config.storageEndpoint || undefined,
      credentials:
        config.storageAccessKey && config.storageSecretKey
          ? {
              accessKeyId: config.storageAccessKey,
              secretAccessKey: config.storageSecretKey,
            }
          : undefined,
      forcePathStyle: Boolean(config.storageEndpoint),
    });
  }

  async save(buffer: Buffer, key: string, contentType: string): Promise<StoredFile> {
    const cleanKey = safeStorageKey([key]);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { key: cleanKey, size: buffer.length, contentType };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const body = res.Body;
      if (!body) return null;
      return Buffer.from(await body.transformToByteArray());
    } catch {
      return null;
    }
  }

  async getStream(key: string): Promise<NodeJS.ReadableStream | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!res.Body) return null;
      return res.Body.transformToWebStream() as unknown as NodeJS.ReadableStream;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      // ignore
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }
}
