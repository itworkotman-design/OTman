import { NextResponse } from "next/server";
import { archive, ARCHIVE_MAX_UPLOAD_SIZE_BYTES } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";

// Mirrors app/api/archive/items/[itemId]/files/route.ts's upload handler,
// but shaped as a direct passthrough to `uploadFile` for the vendored
// archive-ui package's `ArchiveUiFileTransport.uploadFile` — file bytes stay
// out of the generic JSON RPC route entirely, matching the bridge's own
// deliberate separation of `service` (JSON-safe) from `transport` (byte
// content).
export async function POST(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const archiveItemId = formData?.get("archiveItemId");

  if (!(file instanceof File) || typeof archiveItemId !== "string" || !archiveItemId) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  if (file.size > ARCHIVE_MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json({ ok: false, reason: "validation", message: "File too large" }, { status: 400 });
  }

  const content = new Uint8Array(await file.arrayBuffer());
  const ctx = buildArchiveContext(result.session, result.membership);

  const uploadResult = await archive.uploadFile(ctx, {
    archiveItemId,
    originalFileName: file.name,
    mimeType: file.type || "application/octet-stream",
    content,
  });

  return NextResponse.json(uploadResult);
}
