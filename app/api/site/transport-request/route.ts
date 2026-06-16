import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { applyOrderPricingSnapshot, getSavedOrderPricingSnapshot } from "@/lib/booking/pricing/snapshot";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { buildOrderPricingSnapshot } from "@/lib/orders/orderTotals";
import { reserveNextManualOrderNumber } from "@/lib/orders/orderNumber";
import { createOrderCreatedEvent, buildOrderEventSnapshot } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { TRANSPORT_PACKAGE_PRICELIST_ID } from "@/lib/content/TransportRequestConfig";
import { sendEmail } from "@/lib/email/sendEmail";
import { ORDER_NOTIFICATION_EMAIL } from "@/lib/orders/orderNotificationEmail";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// Module-level rate limit state — persists across warm invocations
const _rl = { lastAt: 0, dayStr: "", dayCount: 0 };

function checkRateLimit(): "ok" | "minute" | "daily" {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (_rl.dayStr !== today) { _rl.dayStr = today; _rl.dayCount = 0; }
  if (now - _rl.lastAt < 60_000) return "minute";
  if (_rl.dayCount >= 20) return "daily";
  _rl.lastAt = now;
  _rl.dayCount++;
  return "ok";
}

const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISALLOWED_RE = /[<>'"`;\\{}[\]]/;

function hasDisallowed(v: string) {
  return DISALLOWED_RE.test(v);
}

function validatePhoneField(v: string): string | null {
  const t = v.trim();
  if (!t) return "Required";
  if (!PHONE_RE.test(t)) return "Invalid phone number";
  if (hasDisallowed(v)) return "Contains disallowed characters";
  return null;
}

function validateEmailField(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (!EMAIL_RE.test(t)) return "Invalid email address";
  if (hasDisallowed(v)) return "Contains disallowed characters";
  return null;
}

function validateTextField(v: string): string | null {
  if (hasDisallowed(v)) return "Contains disallowed characters";
  return null;
}

type RequestBody = Record<string, unknown>;

function str(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s || null;
}

function formatDropoffContact(body: RequestBody): string | null {
  const parts: string[] = [];
  const name = str(body.dropoffContactName);
  const phone = str(body.dropoffContactPhone);
  const email = str(body.dropoffContactEmail);
  if (name) parts.push(`Drop-off: ${name}`);
  if (phone) parts.push(`Phone: ${phone}`);
  if (email) parts.push(`Email: ${email}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function row(label: string, value: string | null | undefined) {
  if (!value) return "";
  return `<tr><td style="padding:6px 12px 6px 0;color:#555;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;color:#111">${value}</td></tr>`;
}

function getCategorySubject(categoryId: string | null): string {
  switch (categoryId) {
    case "collection-pickup": return "Website order - Henting og oppsamling";
    case "moving-relocation": return "Website order - Flytting og relokasjon";
    case "custom-transport":  return "Website order - Spesialtransport";
    default: return "Website order";
  }
}

function emailHtml(subject: string, tableRows: string): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
  <h2 style="background:#273097;color:#fff;margin:0;padding:20px 24px;border-radius:8px 8px 0 0">${subject}</h2>
  <div style="border:1px solid #e0e4f0;border-top:none;border-radius:0 0 8px 8px;padding:24px">
    <table style="width:100%;border-collapse:collapse">${tableRows}</table>
  </div>
</div>`;
}

async function sendCollectionEmail(body: RequestBody): Promise<void> {
  const subject = getCategorySubject(str(body.categoryId));
  const pickup = str(body.pickupAddress) ?? "—";
  const dropoff = str(body.dropoffAddress) ?? "—";
  const pickupName = str(body.pickupContactName) ?? "—";
  const pickupPhone = str(body.pickupContactPhone) ?? "—";
  const pickupEmail = str(body.pickupContactEmail);
  const dropoffName = str(body.dropoffContactName) ?? "—";
  const dropoffPhone = str(body.dropoffContactPhone) ?? "—";
  const dropoffEmail = str(body.dropoffContactEmail);
  const date = str(body.preferredDate) ?? "—";
  const timeWindow = str(body.timeWindow) ?? "—";
  const notes = str(body.notes);
  const productCount = Array.isArray(body.productCards) ? body.productCards.length : 0;

  const tableRows = [
    row("Pickup address", pickup),
    row("Pickup contact", pickupName),
    row("Pickup phone", pickupPhone),
    pickupEmail ? row("Pickup email", pickupEmail) : "",
    row("Drop-off address", dropoff),
    row("Drop-off contact", dropoffName),
    row("Drop-off phone", dropoffPhone),
    dropoffEmail ? row("Drop-off email", dropoffEmail) : "",
    row("Preferred date", date),
    row("Time window", timeWindow),
    productCount > 0 ? row("Products", `${productCount} product${productCount > 1 ? "s" : ""}`) : "",
    notes ? row("Notes", notes) : "",
  ].join("");

  await sendEmail({
    to: { email: ORDER_NOTIFICATION_EMAIL },
    subject,
    html: emailHtml(subject, tableRows),
    text: `${subject}\n\nPickup: ${pickup}\nPickup contact: ${pickupName} / ${pickupPhone}${pickupEmail ? ` / ${pickupEmail}` : ""}\nDrop-off: ${dropoff}\nDrop-off contact: ${dropoffName} / ${dropoffPhone}${dropoffEmail ? ` / ${dropoffEmail}` : ""}\nDate: ${date}\nTime: ${timeWindow}${productCount > 0 ? `\nProducts: ${productCount}` : ""}${notes ? `\nNotes: ${notes}` : ""}`,
    ...(pickupEmail ? { replyTo: { email: pickupEmail, name: pickupName } } : {}),
  });
}

async function sendTransportEmail(body: RequestBody): Promise<void> {
  const subject = getCategorySubject(str(body.categoryId));
  const name = str(body.name) ?? "—";
  const phone = str(body.phone) ?? "—";
  const email = str(body.email) ?? "—";
  const pickup = str(body.pickupAddress) ?? "—";
  const delivery = str(body.deliveryAddress) ?? "—";
  const date = str(body.preferredDate) ?? "—";
  const timeWindow = str(body.timeWindow) ?? "—";
  const notes = str(body.notes);
  const squareMeters = str(body.squareMeters);
  const sizeW = str(body.sizeW);
  const sizeH = str(body.sizeH);
  const sizeL = str(body.sizeL);
  const weight = str(body.weight);
  const units = str(body.units);

  const tableRows = [
    row("From", name),
    row("Phone", phone),
    row("Email", email),
    row("Pickup address", pickup),
    row("Delivery address", delivery),
    row("Preferred date", date),
    row("Time window", timeWindow),
    squareMeters ? row("Area (m²)", squareMeters) : "",
    sizeW || sizeH || sizeL ? row("Dimensions (W×H×L)", [sizeW, sizeH, sizeL].map((v) => v ?? "—").join(" × ")) : "",
    weight ? row("Weight", weight) : "",
    units ? row("Units", units) : "",
    notes ? row("Notes", notes) : "",
  ].join("");

  const textExtra = [
    squareMeters ? `Area: ${squareMeters}` : "",
    sizeW || sizeH || sizeL ? `Dimensions: ${sizeW ?? "—"} × ${sizeH ?? "—"} × ${sizeL ?? "—"}` : "",
    weight ? `Weight: ${weight}` : "",
    units ? `Units: ${units}` : "",
  ].filter(Boolean).join("\n");

  await sendEmail({
    to: { email: ORDER_NOTIFICATION_EMAIL },
    subject,
    html: emailHtml(subject, tableRows),
    text: `${subject}\n\nFrom: ${name}\nPhone: ${phone}\nEmail: ${email}\nPickup: ${pickup}\nDelivery: ${delivery}\nDate: ${date}\nTime: ${timeWindow}${textExtra ? `\n${textExtra}` : ""}${notes ? `\nNotes: ${notes}` : ""}`,
    ...(str(body.email) ? { replyTo: { email: str(body.email)!, name } } : {}),
  });
}

async function createWebsiteOrder(body: RequestBody): Promise<{ orderId: string; displayId: number }> {
  const membershipId = process.env.WEBSITE_MEMBERSHIP_ID;
  if (!membershipId) throw new Error("WEBSITE_MEMBERSHIP_ID not configured");

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, companyId: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Website membership not found or inactive");
  }

  const catalog = await getBookingCatalog(TRANSPORT_PACKAGE_PRICELIST_ID);

  const productCards = (body.productCards as SavedProductCard[] | undefined) ?? [];

  const pricingSource = applyOrderPricingSnapshot({
    catalogProducts: catalog.products,
    catalogSpecialOptions: catalog.specialOptions,
    priceListSettings: catalog.priceListSettings,
    pricingSnapshot: getSavedOrderPricingSnapshot(productCards),
  });

  const builtItems = buildOrderItemsFromCards(
    productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
  );

  const summaries = buildOrderSummaries(
    productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
  );

  const pricingSnapshot = buildOrderPricingSnapshot({
    lines: builtItems,
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
  });

  const displayId = await reserveNextManualOrderNumber(membership.companyId);

  const isCollection = body.formType === "collection";

  const order = await prisma.order.create({
    data: {
      companyId: membership.companyId,
      createdByMembershipId: membership.id,
      priceListId: TRANSPORT_PACKAGE_PRICELIST_ID,
      displayId,
      status: "processing",
      pickupAddress: str(body.pickupAddress),
      deliveryAddress: isCollection ? str(body.dropoffAddress) : str(body.deliveryAddress),
      customerName: isCollection ? str(body.pickupContactName) : str(body.name),
      phone: isCollection ? str(body.pickupContactPhone) : str(body.phone),
      email: isCollection ? str(body.pickupContactEmail) : str(body.email),
      customerComments: isCollection ? formatDropoffContact(body) : null,
      deliveryDate: str(body.preferredDate),
      timeWindow: str(body.timeWindow),
      description: str(body.notes),
      priceExVat: Math.round(pricingSnapshot.customer.totalExVat),
      priceSubcontractor: Math.round(pricingSnapshot.subcontractor.total),
      productCardsSnapshot: productCards as unknown as Prisma.InputJsonValue,
      pricingSnapshot: pricingSnapshot as unknown as Prisma.InputJsonValue,
      ...summaries,
    },
  });

  if (builtItems.length > 0) {
    await prisma.orderItem.createMany({
      data: builtItems.map((item) => ({
        orderId: order.id,
        cardId: item.cardId,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        deliveryType: item.deliveryType,
        itemType: item.itemType,
        optionId: item.optionId,
        optionCode: item.optionCode,
        optionLabel: item.optionLabel,
        quantity: item.quantity,
        customerPriceCents: item.customerPriceCents,
        subcontractorPriceCents: item.subcontractorPriceCents,
        rawData: item.rawData as Prisma.InputJsonValue,
      })),
    });
  }

  await createOrderCreatedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: { membershipId: membership.id, name: "website", email: "website", source: "USER" },
    snapshot: buildOrderEventSnapshot({
      displayId: order.displayId,
      status: order.status ?? null,
      customerName: order.customerName,
      phone: order.phone,
      email: order.email,
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      timeWindow: order.timeWindow,
      customerComments: order.customerComments,
      description: order.description,
      priceExVat: order.priceExVat,
      priceSubcontractor: order.priceSubcontractor,
      ...summaries,
    }),
  });

  await createOrderNotification(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    type: "MANUAL_REVIEW",
    title: "WEBSITE ORDER!!",
    message: `Order placed via the public website. Customer: ${order.customerName ?? "—"}, Phone: ${order.phone ?? "—"}, Email: ${order.email ?? "—"}.`,
  });

  return { orderId: order.id, displayId: order.displayId };
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const rl = checkRateLimit();
  if (rl === "minute") {
    return NextResponse.json({ ok: false, reason: "RATE_LIMIT_MINUTE" }, { status: 429 });
  }
  if (rl === "daily") {
    return NextResponse.json({ ok: false, reason: "RATE_LIMIT_DAILY" }, { status: 429 });
  }

  const errors: Record<string, string> = {};
  const s = (v: unknown) => String(v ?? "");

  // Phone validation
  for (const field of ["pickupContactPhone", "dropoffContactPhone", "phone"] as const) {
    if (field in body) {
      const err = validatePhoneField(s(body[field]));
      if (err) errors[field] = err;
    }
  }

  // Email validation
  for (const field of ["pickupContactEmail", "dropoffContactEmail", "email"] as const) {
    if (field in body) {
      const err = validateEmailField(s(body[field]));
      if (err) errors[field] = err;
    }
  }

  // Disallowed characters in text fields
  const textFields = [
    "pickupAddress", "dropoffAddress", "deliveryAddress",
    "pickupContactName", "dropoffContactName",
    "name", "timeWindow", "notes", "location",
  ];
  for (const field of textFields) {
    if (field in body && !(field in errors)) {
      const err = validateTextField(s(body[field]));
      if (err) errors[field] = err;
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, reason: "VALIDATION_FAILED", errors }, { status: 422 });
  }

  if (body.formType === "transport") {
    try {
      await sendTransportEmail(body);
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
      console.error("[transport-request] Email send failed:", err);
      return NextResponse.json({ ok: false, reason: "EMAIL_SEND_FAILED" }, { status: 500 });
    }
  }

  try {
    const result = await createWebsiteOrder(body);
    sendCollectionEmail(body).catch((err) => console.error("[transport-request] Collection email failed:", err));
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[transport-request] Order creation failed:", err);
    return NextResponse.json({ ok: false, reason: "ORDER_CREATION_FAILED" }, { status: 500 });
  }
}
