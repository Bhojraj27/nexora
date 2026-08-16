import "server-only";
import mongoose from "mongoose";
import { config } from "@/lib/config";
import { logger } from "@/lib/logger";

/**
 * Mongoose connection with global caching so HMR / serverless don't open
 * new pools on every request.
 */

const globalForMongoose = globalThis as unknown as {
  mongooseConn?: typeof mongoose;
};

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (globalForMongoose.mongooseConn?.connection.readyState === 1) {
    return globalForMongoose.mongooseConn;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(config.mongodbUri, {
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => {
        logger.info("mongo connected", { uri: redactUri(config.mongodbUri) });
        globalForMongoose.mongooseConn = m;
        return m;
      })
      .catch((err) => {
        connectionPromise = null;
        logger.error("mongo connection failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      });
  }

  return connectionPromise;
}

export async function disconnectDB(): Promise<void> {
  connectionPromise = null;
  if (globalForMongoose.mongooseConn) {
    await globalForMongoose.mongooseConn.disconnect();
    delete globalForMongoose.mongooseConn;
  }
}

export async function pingDB(): Promise<boolean> {
  try {
    const db = await connectDB();
    await db.connection.db?.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

function redactUri(uri: string): string {
  return uri.replace(/\/\/[^@]+@/, "//***:***@");
}
