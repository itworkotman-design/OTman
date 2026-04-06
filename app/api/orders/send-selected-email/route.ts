// app/api/orders/send-selected-email/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canEditOrders } from "@/lib/users/orderAccess";
import { sendEmail } from "@/lib/email/sendEmail";
import type { AppPermission } from "@/lib/users/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPriceNok(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `NOK ${value.toLocaleString("nb-NO")}`;
}

function formatDateNorwegian(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatTimeWindow(value?: string | null) {
  if (!value) return "";
  return value.replace("-", " - ");
}

function tableRow(label: string, value?: string | null) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:10px 12px;border:1px solid #dbe3f0;background:#f8fafc;font-weight:700;width:220px;vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:10px 12px;border:1px solid #dbe3f0;vertical-align:top;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

function formatOrderBlockHtml(order: {
  orderNumber?: string | null;
  deliveryDate?: string | null;
  timeWindow?: string | null;
  customerLabel?: string | null;
  customerName?: string | null;
  phone?: string | null;
  pickupAddress?: string | null;
  extraPickupAddress?: string[] | null;
  deliveryAddress?: string | null;
  returnAddress?: string | null;
  productsSummary?: string | null;
  cashierName?: string | null;
  priceExVat?: number | null;
}) {
  const extraPickupAddress =
    Array.isArray(order.extraPickupAddress) &&
    order.extraPickupAddress.length > 0
      ? order.extraPickupAddress.join(", ")
      : "";

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="border-collapse:collapse;margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
      <tr>
        <td colspan="2" style="padding:12px 14px;background:#273097;color:#ffffff;font-weight:700;font-size:15px;">
          Bestilling
        </td>
      </tr>

      ${tableRow("Leveringsdato", formatDateNorwegian(order.deliveryDate))}
      ${tableRow("Tidsvindu for levering", formatTimeWindow(order.timeWindow))}
      ${tableRow("Customer", order.customerLabel)}
      ${tableRow("Power Bilagsnummer", order.orderNumber)}
      ${tableRow("Kundens Navn", order.customerName)}
      ${tableRow("Kundens Telefon", order.phone)}
      ${tableRow("Henteadresse", order.pickupAddress)}
      ${tableRow("Ekstra hentesteder", extraPickupAddress)}
      ${tableRow("Leveringsadresse", order.deliveryAddress)}
      ${tableRow("Returadresse", order.returnAddress)}
      ${tableRow("Produkter", order.productsSummary)}
      ${tableRow("Kasserers navn", order.cashierName)}
      ${tableRow("Pris uten MVA", formatPriceNok(order.priceExVat))}
    </table>
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

  const body = await req.json().catch(() => null);

  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter(
        (value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const to =
    typeof body?.to === "string" && body.to.trim().length > 0
      ? body.to.trim()
      : "";

  const subject =
    typeof body?.subject === "string" && body.subject.trim().length > 0
      ? body.subject.trim()
      : "Valgte bestillinger";

  const message =
    typeof body?.message === "string" && body.message.trim().length > 0
      ? body.message.trim()
      : "";

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
      orderNumber: true,
      deliveryDate: true,
      timeWindow: true,
      customerLabel: true,
      customerName: true,
      phone: true,
      pickupAddress: true,
      extraPickupAddress: true,
      deliveryAddress: true,
      returnAddress: true,
      productsSummary: true,
      cashierName: true,
      priceExVat: true,
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

  const recipientName =
    typeof body?.recipientName === "string" &&
    body.recipientName.trim().length > 0
      ? body.recipientName.trim()
      : "kunde";

const greetingName = recipientName;

  const htmlBody = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;max-width:900px;margin:0 auto;">
      <p style="margin:0 0 16px 0;">Hei ${escapeHtml(greetingName)},</p>

      ${
        message
          ? `<p style="margin:0 0 20px 0;">${escapeHtml(message)}</p>`
          : ""
      }

      ${orders.map((order) => formatOrderBlockHtml(order)).join("")}

      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 16px 0;">For å se bestillingen din, logg inn.</p>

        <p style="margin:0 0 16px 0;">
          Med vennlig hilsen,<br/>
          Otman Transport AS | otman.no<br/>
          +47 402 84 977 | bestilling@otman.no
        </p>

        <div style="margin-top:12px;">
          <img
            src="https://otman.no/wp-content/uploads/2023/12/logo-removebg.png"
            alt="Otman Transport Logo"
            style="display:block;max-height:48px;width:auto;"
          />
        </div>
      </div>
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
