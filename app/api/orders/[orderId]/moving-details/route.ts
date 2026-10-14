import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";
import { getMovingCatalog } from "@/lib/content/getMovingCatalog";
import { MOVING_ORDER_KIND, parseMovingBookingDetails } from "@/lib/orders/movingBookingDetails";
import { lookUpMovingDrivingDistance } from "@/lib/orders/movingDrivingDistance";
import { movingEditFromOrder, movingOrderSaveData, parseMovingEdit } from "@/lib/orders/movingOrderEdit";
import { priceMovingOrder } from "@/lib/orders/movingOrderQuote";
import { movingOrderSaveWrites } from "@/lib/orders/movingOrderWrites";
import { buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { createOrderUpdatedEvent, type OrderEventChange } from "@/lib/orders/orderEvents";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { handlingFromOrder, parseWebsiteOrderHandling } from "@/lib/orders/websiteOrderHandling";
import { validateTextField } from "@/lib/orders/websiteOrderValidation";

// The admin's edit of a homepage move (WebsiteOrderModal, websiteOrderKind
// MOVING): the move itself — addresses, both ends, services (`edit`),
// re-priced from the moving catalog like a booking (priceMovingOrder) with the
// distance re-checked when an address moved — the customer's contact details
// and schedule, and the "Handle order" panel's fields that don't change a
// move's price (`handling`: drivers, plate, internal description, date). The
// white-goods price fields (express, deviation, calculator) don't apply to a
// move and are never written here. `dryRun` previews the price against what
// was paid, without saving. Status and partner save through /api/orders/bulk.

const LOCKED_STATUSES = new Set(["cancelled", "completed", "invoiced", "paid"]);

const ORDER_SELECT = {
  id: true,
  companyId: true,
  status: true,
  websiteOrderKind: true,
  websiteBookingDetails: true,
  pickupAddress: true,
  deliveryAddress: true,
  extraPickupAddress: true,
  drivingDistance: true,
  deliveryDate: true,
  timeWindow: true,
  customerName: true,
  phone: true,
  email: true,
  customerComments: true,
  description: true,
  driver: true,
  secondDriver: true,
  driverInfo: true,
  licensePlate: true,
  deviation: true,
  expressDelivery: true,
  rabatt: true,
  leggTil: true,
  subcontractorMinus: true,
  subcontractorPlus: true,
  priceExVat: true,
  priceSubcontractor: true,
  pricingSnapshot: true,
  productsSummary: true,
  payments: { select: { amountChargedCents: true, createdAt: true, orderSnapshot: true } },
} as const;

type Params = { params: Promise<{ orderId: string }> };

const reject = (reason: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, reason, ...extra }, { status });

// Company owner/admin, or anyone with Website orders at ADMIN level (as website-items).
async function authorize(req: Request) {
  const session = await getAuthenticatedSession(req);
  if (!session) return { ok: false as const, response: reject("UNAUTHORIZED", 401) };
  if (!session.activeCompanyId) return { ok: false as const, response: reject("TENANT_SELECTION_REQUIRED", 409) };
  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId: session.activeCompanyId, status: "ACTIVE" },
    select: { id: true, role: true, appAccess: true, user: { select: { username: true, email: true } } },
  });
  const websiteOrders = membership ? getModuleAccess(membership, "WEBSITE_ORDERS") : null;
  const canEdit =
    !!membership &&
    (membership.role === "OWNER" || membership.role === "ADMIN" || (!!websiteOrders?.enabled && websiteOrders.level === "ADMIN"));
  if (!membership || !canEdit) return { ok: false as const, response: reject("FORBIDDEN", 403) };
  return { ok: true as const, companyId: session.activeCompanyId, membership };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const LOGGED_FIELDS = [
  ["customerName", "Customer name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["customerComments", "Customer comments"],
  ["pickupAddress", "Pickup address"],
  ["deliveryAddress", "Delivery address"],
  ["deliveryDate", "Delivery date"],
  ["timeWindow", "Time window"],
  ["drivingDistance", "Driving distance"],
  ["productsSummary", "Products"],
  ["driver", "Driver"],
  ["secondDriver", "Second driver"],
  ["driverInfo", "Info for the driver"],
  ["licensePlate", "License plate"],
  ["description", "Description"],
] as const;

export async function PUT(req: Request, { params }: Params) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;
  const { companyId, membership } = auth;

  const body = record(await req.json().catch(() => null));
  if (!body) return reject("INVALID_BODY", 400);
  const dryRun = body.dryRun === true;

  const { orderId } = await params;
  const order = await prisma.order.findFirst({ where: { id: orderId, companyId }, select: ORDER_SELECT });
  if (!order || order.websiteOrderKind !== MOVING_ORDER_KIND) return reject("NOT_FOUND", 404);

  const changesOrder = body.edit !== undefined || body.customer !== undefined || body.preferredDate !== undefined || body.timeWindow !== undefined;
  if (changesOrder && LOCKED_STATUSES.has(normalizeOrderStatus(order.status))) return reject("NOT_EDITABLE_STATUS", 409);

  const data: Record<string, unknown> = { lastEditedByMembershipId: membership.id };

  // "Handle order": only what doesn't change a move's price.
  if (body.handling !== undefined) {
    // The white-goods price fields are dropped before validating: they're
    // never stored on a move, so they mustn't fail its save either.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deviation, customDeviation, expressDelivery, rabatt, leggTil, subcontractorMinus, subcontractorPlus, ...sent } =
      record(body.handling) ?? {};
    const parsed = parseWebsiteOrderHandling(sent, handlingFromOrder(order));
    if (!parsed.ok) return reject(parsed.reason, 422, { errors: parsed.errors });
    const h = parsed.handling;
    Object.assign(data, {
      driver: h.driver || null,
      secondDriver: h.secondDriver || null,
      driverInfo: h.driverInfo || null,
      licensePlate: h.licensePlate || null,
      description: h.description || null,
      deliveryDate: h.deliveryDate || null,
      timeWindow: h.timeWindow || null,
    });
  }

  // The customer's contact details and schedule (an admin may leave a field empty).
  const sentCustomer = record(body.customer);
  if (sentCustomer) {
    const customer = {
      customerName: text(sentCustomer.name) || null,
      phone: text(sentCustomer.phone) || null,
      email: text(sentCustomer.email) || null,
      customerComments: text(sentCustomer.comments) || null,
    };
    const invalid = Object.entries(customer).filter(([, value]) => value && validateTextField(value));
    if (invalid.length > 0) return reject("INVALID_DETAILS", 422, { errors: Object.fromEntries(invalid.map(([key]) => [key, "Contains disallowed characters"])) });
    Object.assign(data, customer);
  }
  if (body.preferredDate !== undefined) data.deliveryDate = text(body.preferredDate) || null;
  if (body.timeWindow !== undefined) data.timeWindow = text(body.timeWindow) || null;

  // The move itself, re-priced.
  let save: ReturnType<typeof movingOrderSaveData> | null = null;
  if (body.edit !== undefined) {
    const parsed = parseMovingEdit(body.edit);
    if (!parsed.ok) return reject("INVALID_DETAILS", 422, { errors: parsed.errors });
    const before = movingEditFromOrder(order);
    const addressesMoved =
      !before ||
      before.pickupAddress.trim() !== parsed.edit.pickupAddress ||
      before.deliveryAddress.trim() !== parsed.edit.deliveryAddress;
    const drivingDistance = addressesMoved
      ? await lookUpMovingDrivingDistance(parsed.edit.pickupAddress, parsed.edit.deliveryAddress)
      : order.drivingDistance ?? "";

    const catalog = await getMovingCatalog();
    if (!catalog) return reject("CATALOG_UNAVAILABLE", 500);
    const quote = priceMovingOrder(catalog, {
      origin: parsed.origin,
      destination: parsed.destination,
      serviceCodes: parsed.edit.serviceCodes,
      drivingDistance,
    });
    if (!quote.ok) return reject("INVALID_DETAILS", 422, { errors: quote.errors });
    const notes = "customerComments" in data ? (data.customerComments as string | null) : order.customerComments;
    save = movingOrderSaveData({
      quote,
      parsed,
      drivingDistance,
      notes,
      customerType: parseMovingBookingDetails(order.websiteBookingDetails)?.customerType ?? null,
    });
  }

  // The order after this save, against what was paid.
  const after = { ...order, ...data, ...(save?.orderData ?? {}) } as typeof order;
  const comparison = compareOrderWithPayments({ payments: order.payments, current: buildOrderStateSnapshot(after) });
  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, previousPriceExVat: order.priceExVat, priceExVat: after.priceExVat, comparison });
  }

  try {
    if (save) await prisma.$transaction(movingOrderSaveWrites(order.id, save, data));
    else await prisma.order.update({ where: { id: order.id }, data });
  } catch (err) {
    console.error("[moving-details] Failed to save order:", err);
    return reject("UPDATE_FAILED", 500);
  }

  const changes: OrderEventChange[] = LOGGED_FIELDS.map(([field, label]) => ({
    field,
    label,
    previousValue: String(order[field] ?? ""),
    nextValue: String(after[field] ?? ""),
  }));
  if (order.priceExVat !== after.priceExVat) {
    changes.push({ field: "priceExVat", label: "Price (ex VAT)", previousValue: String(order.priceExVat), nextValue: String(after.priceExVat) });
  }
  try {
    await createOrderUpdatedEvent(prisma, {
      orderId: order.id,
      companyId,
      actor: { membershipId: membership.id, name: membership.user?.username ?? null, email: membership.user?.email ?? null, source: "USER" },
      changes: changes.filter((change) => change.previousValue !== change.nextValue),
    });
  } catch (err) {
    console.error("[moving-details] Failed to log the change:", err);
  }

  return NextResponse.json({ ok: true, previousPriceExVat: order.priceExVat, priceExVat: after.priceExVat, comparison });
}
