import { NextResponse } from "next/server";
import { ARCHIVE_MAX_UPLOAD_SIZE_BYTES, archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

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
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { session, membership } = result;
  const { itemId } = await params;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
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

  if (file.size > ARCHIVE_MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, reason: "FILE_TOO_LARGE" },
      { status: 400 },
    );
  }

  const content = new Uint8Array(await file.arrayBuffer());
  const ctx = buildArchiveContext(session, membership);

  const uploadResult = await archive.uploadFile(ctx, {
    archiveItemId: itemId,
    originalFileName: file.name?.trim() || "file",
    mimeType: file.type || "application/octet-stream",
    content,
  });

  if (!uploadResult.ok) {
    return NextResponse.json(
      { ok: false, reason: uploadResult.error.category, message: uploadResult.error.message },
      { status: archiveErrorStatus(uploadResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, file: uploadResult.value }, { status: 201 });
}
