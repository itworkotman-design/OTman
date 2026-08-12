import { NextResponse } from "next/server";
import { ARCHIVE_MAX_UPLOAD_SIZE_BYTES, archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { assignFileToSection, assignOrphanFiles, getContentSection } from "@/lib/docArchive/contentSections";
import { getFileDescriptionsMap, setFileDescription } from "@/lib/docArchive/fileDescriptions";
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

  const sectionMap = await assignOrphanFiles(
    ctx.companyId,
    ctx.tenantId,
    itemId,
    listResult.value.map((f) => ({ id: f.id, mimeType: f.mimeType })),
  );
  const descriptionMap = await getFileDescriptionsMap(listResult.value.map((f) => f.id));
  const files = listResult.value.map((f) => ({
    ...f,
    sectionId: sectionMap.get(f.id) ?? null,
    description: descriptionMap.get(f.id) ?? null,
  }));

  return NextResponse.json({ ok: true, files });
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

    const { file, fields } = upload;

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

    const sectionId = fields.sectionId;
    if (!sectionId) {
      return NextResponse.json(
        { ok: false, reason: "SECTION_REQUIRED" },
        { status: 400 },
      );
    }

    const content = await file.readContent();
    const ctx = buildArchiveContext(session, membership);

    const section = await getContentSection(ctx.companyId, ctx.tenantId, sectionId);
    if (!section || section.itemId !== itemId) {
      return NextResponse.json(
        { ok: false, reason: "SECTION_NOT_FOUND" },
        { status: 404 },
      );
    }

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

    await assignFileToSection(ctx.companyId, ctx.tenantId, uploadResult.value.id, sectionId);

    // Description travels in the same multipart request as the file itself
    // (fields.description, alongside sectionId) rather than a separate PATCH
    // after the fact — an empty/missing description is a safe no-op (see
    // setFileDescription).
    const description = await setFileDescription(
      ctx.companyId,
      ctx.tenantId,
      uploadResult.value.id,
      fields.description ?? "",
    );

    return NextResponse.json(
      { ok: true, file: { ...uploadResult.value, sectionId, description } },
      { status: 201 },
    );
  } finally {
    await upload?.cleanup();
    releaseUploadSlot();
  }
}
