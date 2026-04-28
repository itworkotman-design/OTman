import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canCreateOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";

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

export async function GET(
  req: Request,
  {
    params,
  }: { params: Promise<{ orderId: string; attachmentId: string }> },
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
    },
  });

  if (!attachment) {
    return NextResponse.json(
      { ok: false, reason: "ATTACHMENT_NOT_FOUND" },
      { status: 404 },
    );
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

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${contentDispositionFilename(
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

