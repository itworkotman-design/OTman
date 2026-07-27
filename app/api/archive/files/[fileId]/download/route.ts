import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

function contentDispositionFilename(filename: string): string {
  return filename.replace(/["\r\n]/g, "_");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  if (buffer instanceof ArrayBuffer) {
    return buffer;
  }

  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const requestUrl = new URL(req.url);
  const shouldDownload = requestUrl.searchParams.get("download") === "1";

  const { fileId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const downloadResult = await archive.downloadFile(ctx, fileId);

  if (!downloadResult.ok) {
    return NextResponse.json(
      { ok: false, reason: downloadResult.error.category, message: downloadResult.error.message },
      { status: archiveErrorStatus(downloadResult.error.category) },
    );
  }

  const { file, content } = downloadResult.value;

  return new NextResponse(toArrayBuffer(content), {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${contentDispositionFilename(
        file.originalFileName,
      )}"`,
      "Content-Length": String(file.sizeBytes),
    },
  });
}
