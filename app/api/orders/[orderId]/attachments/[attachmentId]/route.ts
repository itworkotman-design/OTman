import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canEditOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";

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

  if (!canEditOrders(membership.role, permissions)) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const { attachmentId } = await params;

  const attachment = await prisma.orderAttachment.findFirst({
    where: {
      id: attachmentId,
      order: {
        companyId: session.activeCompanyId,
      },
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

  await prisma.orderAttachment.delete({
    where: {
      id: attachment.id,
    },
  });

  if (attachment.storagePath.startsWith("/uploads/")) {
    const absolutePath = path.join(
      process.cwd(),
      "public",
      attachment.storagePath.replace(/^\//, ""),
    );

    try {
      await unlink(absolutePath);
    } catch {
      // file may already be missing, ignore
    }
  }

  return NextResponse.json({
    ok: true,
  });
}
