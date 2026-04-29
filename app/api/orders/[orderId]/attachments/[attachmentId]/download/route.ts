import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canCreateOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";
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

function getRemoteAttachmentUrl(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;

  try {
    const url = new URL(sourceUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function downloadRemoteAttachment(params: {
  sourceUrl: string;
  mimeType: string | null;
}) {
  const response = await fetch(params.sourceUrl, {
    headers: {
      Accept: params.mimeType || "*/*",
    },
  });

  if (!response.ok) {
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length <= 0) {
    return null;
  }

  return {
    bytes,
    mimeType:
      response.headers.get("content-type") || params.mimeType || null,
    sizeBytes: bytes.length,
  };
}

export async function GET(
  req: Request,
  {
    params,
  }: { params: Promise<{ orderId: string; attachmentId: string }> },
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

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      permissions: {
        select: {
          permission: true,
        },
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const permissions = membership.permissions.map(
    (p): AppPermission => p.permission,
  );
  const { orderId, attachmentId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
    },
    select: {
      id: true,
      createdByMembershipId: true,
      customerMembershipId: true,
      subcontractorMembershipId: true,
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "ORDER_NOT_FOUND" },
      { status: 404 },
    );
  }

  const hasOrderAccess =
    canCreateOrders(membership.role, permissions) ||
    order.subcontractorMembershipId === membership.id ||
    order.customerMembershipId === membership.id ||
    order.createdByMembershipId === membership.id;

  if (!hasOrderAccess) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const attachment = await prisma.orderAttachment.findFirst({
    where: {
      id: attachmentId,
      orderId: order.id,
    },
    select: {
      filename: true,
      mimeType: true,
      sizeBytes: true,
      storagePath: true,
      sourceUrl: true,
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

  const sourceUrl = getRemoteAttachmentUrl(attachment.sourceUrl);

  if (!absolutePath && !sourceUrl) {
    return NextResponse.json(
      { ok: false, reason: "ATTACHMENT_FILE_NOT_LOCAL" },
      { status: 404 },
    );
  }

  try {
    if (absolutePath) {
      const [fileStat, bytes] = await Promise.all([
        stat(absolutePath),
        readFile(absolutePath),
      ]);

      return new NextResponse(bytes, {
        headers: {
          "Content-Type": attachment.mimeType || "application/octet-stream",
          "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${contentDispositionFilename(
            attachment.filename,
          )}"`,
          "Content-Length": String(attachment.sizeBytes ?? fileStat.size),
        },
      });
    }
  } catch {
    // Fall back to sourceUrl below when the local WordPress copy is missing.
  }

  if (sourceUrl) {
    const remoteFile = await downloadRemoteAttachment({
      sourceUrl,
      mimeType: attachment.mimeType,
    });

    if (remoteFile) {
      return new NextResponse(remoteFile.bytes, {
        headers: {
          "Content-Type": remoteFile.mimeType || "application/octet-stream",
          "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${contentDispositionFilename(
            attachment.filename,
          )}"`,
          "Content-Length": String(remoteFile.sizeBytes),
        },
      });
    }
  }

  return NextResponse.json(
    { ok: false, reason: "ATTACHMENT_FILE_NOT_FOUND" },
    { status: 404 },
  );
}
