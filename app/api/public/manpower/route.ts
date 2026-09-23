import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";
import { reserveNextManualOrderNumber } from "@/lib/orders/orderNumber";
import { createOrderCreatedEvent, buildOrderEventSnapshot } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { TjenesterContent } from "@/lib/content/TjenesterContent";

// "Services" (Tjenester) — trade/staffing outsourcing (electrician,
// carpenter, plumber, gardener, cleaner, IT, custom), per the already-live
// content in TjenesterContent.ts. This used to only send a plain email to
// bestilling@otman.no; now it creates an unpriced Order (isWebsiteOrder:
// true, priceExVat: 0, status: "processing") instead, landing it in the
// same dashboard review / staff-quote / Stripe pipeline every other website
// order uses (matching Moving and the special-goods quote flow before it).
// See docs/homepage-ordering-roadmap.md §6.
//
// The live form's validation contract (field names, error behavior, rate
// limits) is deliberately unchanged — only what happens after validation
// passes is new, so the existing /tjenester UI needed no changes.
//
// The live form only ever collects one freeform "contact" field (not split
// phone/email like every newer flow), so it's classified here rather than
// requiring a UI change: if it looks like an email it becomes Order.email,
// otherwise Order.phone. The raw value is also always kept in the
// description for full fidelity either way. This means Order.email can be
// null (no automatic payment-link/lifecycle emails until staff add one
// manually) — an accepted tradeoff to avoid touching already-live copy; see
// the roadmap doc's progress log for the full reasoning.

const MANPOWER_IP_LIMIT = 5;
const MANPOWER_WINDOW_MS = 10 * 60 * 1000;

// Module-level global rate limit — 1 per minute, 20 per day
const _rl = { lastAt: 0, dayStr: "", dayCount: 0 };

function checkGlobalRateLimit(): "ok" | "minute" | "daily" {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (_rl.dayStr !== today) { _rl.dayStr = today; _rl.dayCount = 0; }
  if (now - _rl.lastAt < 60_000) return "minute";
  if (_rl.dayCount >= 20) return "daily";
  _rl.lastAt = now;
  _rl.dayCount++;
  return "ok";
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const LETTERS_NUMBERS_RE = /^[\p{L}\p{N}\s]+$/u;
const EMAIL_LIKE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

function badRequest(reason: string) {
  return NextResponse.json({ ok: false, reason }, { status: 400 });
}

function classifyContact(contact: string): { email: string | null; phone: string | null } {
  return EMAIL_LIKE_RE.test(contact) ? { email: contact, phone: null } : { email: null, phone: contact };
}

async function createServiceRequestOrder(params: {
  name: string;
  contact: string;
  jobTypeLabel: string;
  description: string;
}): Promise<{ orderId: string; displayId: number }> {
  const membershipId = process.env.WEBSITE_MEMBERSHIP_ID;
  if (!membershipId) throw new Error("WEBSITE_MEMBERSHIP_ID not configured");

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, companyId: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Website membership not found or inactive");
  }

  const displayId = await reserveNextManualOrderNumber(membership.companyId);
  const { email, phone } = classifyContact(params.contact);

  const order = await prisma.order.create({
    data: {
      companyId: membership.companyId,
      createdByMembershipId: membership.id,
      customerMembershipId: membership.id,
      displayId,
      status: "processing",
      isWebsiteOrder: true,
      customerName: params.name,
      phone,
      email,
      description: [
        `Service: ${params.jobTypeLabel}`,
        `Contact info as provided: ${params.contact}`,
        params.description,
      ].join("\n\n"),
      productsSummary: `Service request (${params.jobTypeLabel})`,
      priceExVat: 0,
      priceSubcontractor: 0,
    },
  });

  await createOrderCreatedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: { membershipId: membership.id, name: "website", email: "website", source: "USER" },
    snapshot: buildOrderEventSnapshot({
      displayId: order.displayId,
      status: order.status ?? null,
      customerName: params.name,
      phone,
      email,
      description: order.description,
      priceExVat: order.priceExVat,
      priceSubcontractor: order.priceSubcontractor,
      productsSummary: order.productsSummary,
    }),
  });

  await createOrderNotification(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    type: "MANUAL_REVIEW",
    title: `WEBSITE ORDER - Service request (${params.jobTypeLabel})`,
    message: `Service request placed via /tjenester — needs a manual quote before it can be approved. Customer: ${params.name}, Contact: ${params.contact}.`,
  });

  return { orderId: order.id, displayId: order.displayId };
}

export async function POST(req: Request) {
  const rl = checkGlobalRateLimit();
  if (rl === "minute") return NextResponse.json({ ok: false, reason: "RATE_LIMIT_MINUTE" }, { status: 429 });
  if (rl === "daily")  return NextResponse.json({ ok: false, reason: "RATE_LIMIT_DAILY" },  { status: 429 });

  const ip = getClientIp(req);

  if (ip) {
    const check = await checkRateLimit({ key: `manpower:ip:${ip}`, limit: MANPOWER_IP_LIMIT });
    if (!check.allowed) {
      return NextResponse.json(
        { ok: false, reason: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!body || typeof body !== "object") return badRequest("Invalid body");

  const raw = body as Record<string, unknown>;

  // Honeypot — bots fill this hidden field; real users never see it
  if (raw._hp !== "" && raw._hp !== undefined && raw._hp !== null) {
    return NextResponse.json({ ok: true });
  }

  const nameTrimmed = typeof raw.name === "string" ? raw.name.trim() : "";
  const contactTrimmed = typeof raw.contact === "string" ? raw.contact.trim() : "";
  const jobTypeTrimmed = typeof raw.jobType === "string" ? raw.jobType.trim() : "";
  const customServiceTrimmed = typeof raw.customService === "string" ? raw.customService.trim() : "";
  const descriptionTrimmed = typeof raw.description === "string" ? raw.description.trim() : "";

  if (!nameTrimmed || nameTrimmed.length < 2 || nameTrimmed.length > 80 || !NAME_REGEX.test(nameTrimmed)) {
    return badRequest("Invalid name");
  }
  if (!contactTrimmed || contactTrimmed.length < 5 || contactTrimmed.length > 254) {
    return badRequest("Invalid contact");
  }
  if (!jobTypeTrimmed) {
    return badRequest("Invalid job type");
  }
  if (jobTypeTrimmed === "custom" && (!customServiceTrimmed || customServiceTrimmed.length > 200 || !LETTERS_NUMBERS_RE.test(customServiceTrimmed))) {
    return badRequest("Invalid custom service");
  }
  if (!descriptionTrimmed || descriptionTrimmed.length < 10 || descriptionTrimmed.length > 1000 || !LETTERS_NUMBERS_RE.test(descriptionTrimmed)) {
    return badRequest("Invalid description");
  }

  if (ip) {
    await incrementRateLimit({ key: `manpower:ip:${ip}`, windowMs: MANPOWER_WINDOW_MS });
  }

  const jobTypeOption = TjenesterContent.jobTypeOptions.find((o) => o.value === jobTypeTrimmed);
  const jobTypeLabel = jobTypeTrimmed === "custom"
    ? `${jobTypeOption?.label.en ?? "Custom service"} — ${customServiceTrimmed}`
    : (jobTypeOption?.label.en ?? jobTypeTrimmed);

  try {
    const result = await createServiceRequestOrder({
      name: nameTrimmed,
      contact: contactTrimmed,
      jobTypeLabel,
      description: descriptionTrimmed,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[manpower] Order creation failed:", err);
    return NextResponse.json({ ok: false, reason: "ORDER_CREATION_FAILED" }, { status: 500 });
  }
}
