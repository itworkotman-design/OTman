import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";

// Mirrors app/api/archive/files/[fileId]/download/route.ts, but returns JSON
// (file metadata + base64 content) instead of a raw byte stream, since the
// vendored archive-ui package's `ArchiveUiFileTransport.downloadFile` expects
// the real `ArchiveFileDownload` shape (`{ file: ArchiveFile; content:
// Uint8Array }`) wrapped in an `ArchiveHostAdapterResult` — raw bytes can't
// travel through `fetch(...).json()` as-is, so content is base64-encoded for
// the wire and decoded back into a Uint8Array on the client.
export async function POST(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const body = await req.json().catch(() => null);
  const fileId = typeof body?.fileId === "string" ? body.fileId : "";

  if (!fileId) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const downloadResult = await archive.downloadFile(ctx, fileId);

  if (!downloadResult.ok) {
    return NextResponse.json(downloadResult);
  }

  return NextResponse.json({
    ok: true,
    value: {
      file: downloadResult.value.file,
      contentBase64: Buffer.from(downloadResult.value.content).toString("base64"),
    },
  });
}
