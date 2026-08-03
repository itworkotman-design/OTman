import { NextResponse } from "next/server";
import { ARCHIVE_MAX_UPLOAD_SIZE_BYTES, archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const listResult = await archive.listFilesForItem(ctx, itemId);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, files: listResult.value });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { session, membership } = result;
  const { itemId } = await params;

  if (requestTooLargeByContentLength(req, ARCHIVE_MAX_UPLOAD_SIZE_BYTES)) {
    return NextResponse.json(
      { ok: false, reason: "FILE_TOO_LARGE" },
      { status: 413 },
    );
  }

  const gotSlot = await acquireUploadSlot();
  if (!gotSlot) {
    return NextResponse.json(
      { ok: false, reason: "SERVER_BUSY" },
      { status: 503 },
    );
  }

  let upload: StreamedUpload | null = null;

  try {
    try {
      upload = await receiveMultipartUpload(req, ARCHIVE_MAX_UPLOAD_SIZE_BYTES);
    } catch (error) {
      if (error instanceof UploadTooLargeError) {
        return NextResponse.json(
          { ok: false, reason: "FILE_TOO_LARGE" },
          { status: 413 },
        );
      }
      return NextResponse.json(
        { ok: false, reason: "FILE_REQUIRED" },
        { status: 400 },
      );
    }

    const { file } = upload;

    if (!file) {
      return NextResponse.json(
        { ok: false, reason: "FILE_REQUIRED" },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { ok: false, reason: "EMPTY_FILE" },
        { status: 400 },
      );
    }

    const content = await file.readContent();
    const ctx = buildArchiveContext(session, membership);

    const uploadResult = await archive.uploadFile(ctx, {
      archiveItemId: itemId,
      originalFileName: file.filename?.trim() || "file",
      mimeType: file.mimeType || "application/octet-stream",
      content,
    });

    if (!uploadResult.ok) {
      return NextResponse.json(
        { ok: false, reason: uploadResult.error.category, message: uploadResult.error.message },
        { status: archiveErrorStatus(uploadResult.error.category) },
      );
    }

    return NextResponse.json({ ok: true, file: uploadResult.value }, { status: 201 });
  } finally {
    await upload?.cleanup();
    releaseUploadSlot();
  }
}
