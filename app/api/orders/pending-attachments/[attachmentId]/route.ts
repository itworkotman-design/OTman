import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import {
  deleteAttachmentFromS3,
  isS3StoragePath,
} from "@/lib/orders/orderAttachmentStorage";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
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
      id: true,
      storagePath: true,
    },
  });

  if (!attachment) {
    return NextResponse.json(
      { ok: false, reason: "ATTACHMENT_NOT_FOUND" },
      { status: 404 },
    );
  }

  await prisma.pendingOrderAttachment.delete({
    where: {
      id: attachment.id,
    },
  });

  if (isS3StoragePath(attachment.storagePath)) {
    try {
      await deleteAttachmentFromS3(attachment.storagePath);
    } catch {
      // ignore missing remote object
    }
  } else if (attachment.storagePath.startsWith("/uploads/")) {
    const absolutePath = path.join(
      process.cwd(),
      "public",
      attachment.storagePath.replace(/^\//, ""),
    );

    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing file
    }
  }

  return NextResponse.json({
    ok: true,
  });
}
