import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { createDocumentRecord, enqueueProcessing } from "@/services/documentService";
import { detectExtension, MAX_FILE_SIZE } from "@/lib/documents/extract";
import { assertDocumentAllowed, assertStorageAllowed } from "@/services/usageService";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const workspaceId = formData.get("workspaceId");
    const file = formData.get("file");

    if (typeof workspaceId !== "string") {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const access = await requirePermission("document:create", workspaceId);
    const extension = detectExtension(file.type, file.name);
    if (!extension) {
      return NextResponse.json(
        { error: "Unsupported file type. Supported: PDF, DOCX, TXT, MD, CSV." },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds the ${MAX_FILE_SIZE / 1024 / 1024} MB limit` },
        { status: 413 },
      );
    }

    await assertDocumentAllowed(workspaceId);
    await assertStorageAllowed(workspaceId, file.size);

    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await createDocumentRecord(access, {
      name: file.name.replace(/\.[^/.]+$/, "").slice(0, 200) || "Untitled document",
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      extension,
      size: file.size,
      buffer,
    });

    await enqueueProcessing(doc._id.toString(), workspaceId);

    return NextResponse.json(
      {
        document: {
          id: doc._id.toString(),
          name: doc.name,
          status: doc.status,
          size: doc.size,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
