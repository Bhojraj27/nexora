import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLogModel } from "@/models/AuditLog";

export interface AuditEntry {
  workspaceId: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/**
 * Immutable audit trail. Never expose delete/update endpoints for these records.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await connectDB();
    await AuditLogModel.create({
      workspaceId: entry.workspaceId,
      actorId: entry.actorId,
      actorName: entry.actorName,
      action: entry.action,
      entityType: entry.entityType ?? "",
      entityId: entry.entityId ?? "",
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? "",
    });
  } catch (err) {
    // Audit failures should never break the primary operation.
    console.error("audit log failure", err);
  }
}

export async function getAuditLogs(workspaceId: string, limit = 50, cursor?: string) {
  await connectDB();
  const filter: Record<string, unknown> = { workspaceId };
  if (cursor) filter._id = { $lt: cursor };
  return AuditLogModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
