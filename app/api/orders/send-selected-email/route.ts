// app/api/orders/send-selected-email/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canEditOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";
// Adjust this import to your actual email helper:
import { sendEmail } from "@/lib/email/sendEmail";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatOrderBlock(order: {
  id: string;
  displayId?: number | null;
  orderNumber?: string | null;
  customerLabel?: string | null;
  customerName?: string | null;
  email?: string | null;
  phone?: string | null;
  deliveryDate?: string | null;
  timeWindow?: string | null;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  productsSummary?: string | null;
  servicesSummary?: string | null;
  description?: string | null;
  status?: string | null;
}) {
  const lines = [
    order.displayId ? `Order ID: ${order.displayId}` : null,
    order.orderNumber ? `Order number: ${order.orderNumber}` : null,
    order.customerLabel ? `Customer: ${order.customerLabel}` : null,
    order.customerName ? `Customer name: ${order.customerName}` : null,
    order.email ? `Email: ${order.email}` : null,
    order.phone ? `Phone: ${order.phone}` : null,
    order.deliveryDate ? `Delivery date: ${order.deliveryDate}` : null,
    order.timeWindow ? `Time window: ${order.timeWindow}` : null,
    order.pickupAddress ? `Pickup address: ${order.pickupAddress}` : null,
    order.deliveryAddress ? `Delivery address: ${order.deliveryAddress}` : null,
    order.productsSummary ? `Products: ${order.productsSummary}` : null,
    order.servicesSummary ? `Services: ${order.servicesSummary}` : null,
    order.status ? `Status: ${order.status}` : null,
    order.description ? `Description: ${order.description}` : null,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

function formatOrderBlockHtml(order: {
  displayId?: number | null;
  orderNumber?: string | null;
  customerLabel?: string | null;
  customerName?: string | null;
  email?: string | null;
  phone?: string | null;
  deliveryDate?: string | null;
  timeWindow?: string | null;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  productsSummary?: string | null;
  servicesSummary?: string | null;
  description?: string | null;
  status?: string | null;
}) {
  const rows = [
    order.displayId ? ["Order ID", String(order.displayId)] : null,
    order.orderNumber ? ["Order number", order.orderNumber] : null,
    order.customerLabel ? ["Customer", order.customerLabel] : null,
    order.customerName ? ["Customer name", order.customerName] : null,
    order.email ? ["Email", order.email] : null,
    order.phone ? ["Phone", order.phone] : null,
    order.deliveryDate ? ["Delivery date", order.deliveryDate] : null,
    order.timeWindow ? ["Time window", order.timeWindow] : null,
    order.pickupAddress ? ["Pickup address", order.pickupAddress] : null,
    order.deliveryAddress ? ["Delivery address", order.deliveryAddress] : null,
    order.productsSummary ? ["Products", order.productsSummary] : null,
    order.servicesSummary ? ["Services", order.servicesSummary] : null,
    order.status ? ["Status", order.status] : null,
    order.description ? ["Description", order.description] : null,
  ].filter(Boolean) as [string, string][];

  return `
    <div style="margin-bottom:24px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;">
      ${rows
        .map(
          ([label, value]) => `
            <div style="margin-bottom:8px;">
              <strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export async function POST(req: Request) {
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
      user: {
        select: {
          email: true,
          username: true,
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

  const body = await req.json().catch(() => null);

  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter(
        (value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const to = optionalString(body?.to);
  const subject = optionalString(body?.subject) ?? "Selected orders";
  const message = optionalString(body?.message);

  if (orderIds.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_ORDER_IDS" },
      { status: 400 },
    );
  }

  if (!to) {
    return NextResponse.json(
      { ok: false, reason: "MISSING_RECIPIENT" },
      { status: 400 },
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      companyId: session.activeCompanyId,
    },
    select: {
      id: true,
      displayId: true,
      orderNumber: true,
      customerLabel: true,
      customerName: true,
      email: true,
      phone: true,
      deliveryDate: true,
      timeWindow: true,
      pickupAddress: true,
      deliveryAddress: true,
      productsSummary: true,
      servicesSummary: true,
      description: true,
      status: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (orders.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "NO_ORDERS_FOUND" },
      { status: 404 },
    );
  }

  const textBody = [
    message ?? null,
    orders
      .map((order) => formatOrderBlock(order))
      .join("\n\n--------------------\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const htmlBody = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
      ${
        message
          ? `<p style="margin-bottom:20px;">${escapeHtml(message)}</p>`
          : ""
      }
      ${orders.map((order) => formatOrderBlockHtml(order)).join("")}
    </div>
  `;

  await sendEmail({
    to: {
      email: to,
    },
    subject,
    html: htmlBody,
  });

  return NextResponse.json({
    ok: true,
    sentCount: orders.length,
  });
}
