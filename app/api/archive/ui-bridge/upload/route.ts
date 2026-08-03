import { NextResponse } from "next/server";
import { archive, ARCHIVE_MAX_UPLOAD_SIZE_BYTES } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import {
  acquireUploadSlot,
  releaseUploadSlot,
  requestTooLargeByContentLength,
} from "@/lib/docArchive/uploadGate";
import {
  receiveMultipartUpload,
  UploadTooLargeError,
  type StreamedUpload,
} from "@/lib/docArchive/streamMultipartUpload";

// Mirrors app/api/archive/items/[itemId]/files/route.ts's upload handler,
// but shaped as a direct passthrough to `uploadFile` for the vendored
// archive-ui package's `ArchiveUiFileTransport.uploadFile` — file bytes stay
// out of the generic JSON RPC route entirely, matching the bridge's own
// deliberate separation of `service` (JSON-safe) from `transport` (byte
// content).
export async function POST(req: Request) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  if (requestTooLargeByContentLength(req, ARCHIVE_MAX_UPLOAD_SIZE_BYTES)) {
    return NextResponse.json({ ok: false, reason: "validation", message: "File too large" }, { status: 413 });
  }

  const gotSlot = await acquireUploadSlot();
  if (!gotSlot) {
    return NextResponse.json({ ok: false, reason: "SERVER_BUSY" }, { status: 503 });
  }

  let upload: StreamedUpload | null = null;

  try {
    try {
      upload = await receiveMultipartUpload(req, ARCHIVE_MAX_UPLOAD_SIZE_BYTES);
    } catch (error) {
      if (error instanceof UploadTooLargeError) {
        return NextResponse.json({ ok: false, reason: "validation", message: "File too large" }, { status: 413 });
      }
      return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
    }

    const { file, fields } = upload;
    const archiveItemId = fields.archiveItemId;

    if (!file || typeof archiveItemId !== "string" || !archiveItemId) {
      return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
    }

    const content = await file.readContent();
    const ctx = buildArchiveContext(result.session, result.membership);

    const uploadResult = await archive.uploadFile(ctx, {
      archiveItemId,
      originalFileName: file.filename,
      mimeType: file.mimeType || "application/octet-stream",
      content,
    });

    return NextResponse.json(uploadResult);
  } finally {
    await upload?.cleanup();
    releaseUploadSlot();
  }
}
