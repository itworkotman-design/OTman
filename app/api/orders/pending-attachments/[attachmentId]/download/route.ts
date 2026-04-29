import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  downloadAttachmentFromS3,
  getSignedAttachmentUrl,
  isS3StoragePath,
} from "@/lib/orders/orderAttachmentStorage";

function getLocalUploadPath(storagePath: string): string | null {
  if (!storagePath.startsWith("/uploads/")) return null;

  const relativePath = storagePath.replace(/^\//, "");
  const absolutePath = path.resolve(process.cwd(), "public", relativePath);
  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");

  if (
    absolutePath !== uploadsRoot &&
    !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)
  ) {
    return null;
  }

  return absolutePath;
}

function contentDispositionFilename(filename: string): string {
  return filename.replace(/["\r\n]/g, "_");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );

  if (buffer instanceof ArrayBuffer) {
    return buffer;
  }

  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const requestUrl = new URL(req.url);
  const shouldDownload = requestUrl.searchParams.get("download") === "1";
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { attachmentId } = await params;
  const attachment = await prisma.pendingOrderAttachment.findFirst({
    where: {
      id: attachmentId,
      sessionId: session.userId,
    },
    select: {
      filename: true,
      mimeType: true,
      sizeBytes: true,
      storagePath: true,
    },
  });

  if (!attachment) {
    return NextResponse.json(
      { ok: false, reason: "ATTACHMENT_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (isS3StoragePath(attachment.storagePath)) {
    const signedUrl = await getSignedAttachmentUrl({
      storagePath: attachment.storagePath,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      download: shouldDownload,
    });

    if (signedUrl) {
      return NextResponse.redirect(signedUrl);
    }

    const remoteFile = await downloadAttachmentFromS3(attachment.storagePath);

    if (remoteFile) {
      return new NextResponse(toArrayBuffer(remoteFile.bytes), {
        headers: {
          "Content-Type":
            remoteFile.contentType ||
            attachment.mimeType ||
            "application/octet-stream",
          "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${contentDispositionFilename(
            attachment.filename,
          )}"`,
          "Content-Length": String(remoteFile.sizeBytes),
        },
      });
    }
  }

  const absolutePath = getLocalUploadPath(attachment.storagePath);

  if (!absolutePath) {
    return NextResponse.json(
      { ok: false, reason: "ATTACHMENT_FILE_NOT_LOCAL" },
      { status: 404 },
    );
  }

  try {
    const [fileStat, bytes] = await Promise.all([
      stat(absolutePath),
      readFile(absolutePath),
    ]);

    return new NextResponse(toArrayBuffer(bytes), {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${contentDispositionFilename(
          attachment.filename,
        )}"`,
        "Content-Length": String(attachment.sizeBytes ?? fileStat.size),
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "ATTACHMENT_FILE_NOT_FOUND" },
      { status: 404 },
    );
  }
}
