import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canEditOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";
import { normalizeAttachmentCategory } from "@/lib/orders/attachmentCategories";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function isAllowedAttachmentFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
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

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
    },
    select: { id: true },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "ORDER_NOT_FOUND" },
      { status: 404 },
    );
  }

  const attachments = await prisma.orderAttachment.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    attachments: attachments.map((item) => ({
      id: item.id,
      category: item.category,
      filename: item.filename,
      mimeType: item.mimeType ?? "",
      sizeBytes: item.sizeBytes ?? 0,
      storagePath: item.storagePath,
      createdAt: item.createdAt,
      url: item.storagePath,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
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

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
    },
    select: { id: true },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "ORDER_NOT_FOUND" },
      { status: 404 },
    );
  }

  const existingCount = await prisma.orderAttachment.count({
    where: {
      orderId,
    },
  });

  if (existingCount >= 10) {
    return NextResponse.json(
      { ok: false, reason: "ATTACHMENT_LIMIT_REACHED" },
      { status: 400 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const category = normalizeAttachmentCategory(formData.get("category"));

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

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { ok: false, reason: "FILE_TOO_LARGE" },
      { status: 400 },
    );
  }

  if (!isAllowedAttachmentFile(file)) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_FILE_TYPE" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const originalName = file.name?.trim() || "attachment";
  const ext = path.extname(originalName);
  const safeBaseName = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 80);

  const storedFilename = `${Date.now()}-${randomUUID()}-${safeBaseName}${ext}`;
  const relativeDir = path.join("uploads", "orders", orderId);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  const absolutePath = path.join(absoluteDir, storedFilename);
  const publicPath = `/${relativeDir.replaceAll("\\", "/")}/${storedFilename}`;

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, bytes);

  const attachment = await prisma.orderAttachment.create({
    data: {
      orderId,
      category,
      filename: originalName,
      mimeType: file.type || null,
      sizeBytes: file.size,
      storagePath: publicPath,
    },
  });

  return NextResponse.json({
    ok: true,
    attachment: {
      id: attachment.id,
      category: attachment.category,
      filename: attachment.filename,
      mimeType: attachment.mimeType ?? "",
      sizeBytes: attachment.sizeBytes ?? 0,
      storagePath: attachment.storagePath,
      createdAt: attachment.createdAt,
      url: attachment.storagePath,
    },
  });
}

