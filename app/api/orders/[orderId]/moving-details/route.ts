import { ORDER_PAYMENT_LEDGER_SELECT } from "@/lib/orders/orderPayments";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";
import { getMovingCatalog } from "@/lib/content/getMovingCatalog";
import { MOVING_ORDER_KIND, parseMovingBookingDetails } from "@/lib/orders/movingBookingDetails";
import { lookUpMovingDrivingDistance } from "@/lib/orders/movingDrivingDistance";
import { movingEditFromOrder, movingOrderSaveData, parseMovingEdit } from "@/lib/orders/movingOrderEdit";
import { priceMovingOrder } from "@/lib/orders/movingOrderQuote";
import {
  movingAdjustmentsFromOrder,
  movingNulledFromDraft,
  movingOrderAdjustedPricing,
  movingOrderCalculatorView,
  type MovingAdjustments,
} from "@/lib/orders/movingOrderCalculator";
import { movingPricesOutdated } from "@/lib/orders/movingCurrentPrices";
import { parseNulledLines } from "@/lib/orders/websiteOrderCalculator";
import { movingOrderItemWrites, movingOrderSaveWrites } from "@/lib/orders/movingOrderWrites";
import {
  isMovingHandlingItem,
  movingHandlingFromOrder,
  movingHandlingItemRows,
  movingHandlingLinesChanged,
  storedMovingHandlingRows,
} from "@/lib/orders/movingHandlingLines";
import { buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { createOrderUpdatedEvent, type OrderEventChange } from "@/lib/orders/orderEvents";
import { isWebsiteOrderLocked } from "@/lib/orders/statusPresentation";
import { parseWebsiteOrderHandling } from "@/lib/orders/websiteOrderHandling";
import { validateTextField } from "@/lib/orders/websiteOrderValidation";

// The admin's edit of a homepage move (WebsiteOrderModal, websiteOrderKind
// MOVING): the move itself — addresses, both ends, services (`edit`),
// re-priced from the moving catalog like a booking (priceMovingOrder) with the
// distance re-checked when an address moved — the customer's contact details
// and schedule, and the "Handle order" panel's fields (`handling`: drivers,
// plate, internal description, date) with the calculator's discount/extra and
// partner minus/plus, which re-price the move's lines (movingOrderCalculator).
// Express and the deviation become the move's own lines, priced from the
// moving price list's settings and kept as priced by a later re-price
// (movingHandlingLines).
// `dryRun` previews the price against what was paid, and the calculator,
// without saving. Status and partner save through /api/orders/bulk.


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
  // The move's priced lines — re-priced with the calculator's amounts.
  items: {
    select: {
      cardId: true,
      productCode: true,
      productName: true,
      itemType: true,
      optionCode: true,
      optionLabel: true,
      quantity: true,
      customerPriceCents: true,
      subcontractorPriceCents: true,
    },
  },
  payments: { select: ORDER_PAYMENT_LEDGER_SELECT },
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
  ["expressDelivery", "Express delivery"],
  ["deviation", "Deviation"],
  ["rabatt", "Discount"],
  ["leggTil", "Extra"],
  ["subcontractorMinus", "Partner minus"],
  ["subcontractorPlus", "Partner plus"],
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

  const changesOrder =
    body.edit !== undefined || body.customer !== undefined || body.preferredDate !== undefined || body.timeWindow !== undefined || body.customerType !== undefined;
  if (changesOrder && isWebsiteOrderLocked(order.status)) return reject("NOT_EDITABLE_STATUS", 409);

  const data: Record<string, unknown> = { lastEditedByMembershipId: membership.id };

  // The calculator's discount/extra, partner minus/plus and lines set to 0:
  // the stored ones unless this save sends its own.
  const storedAdjustments = movingAdjustmentsFromOrder(order);
  let adjustments: MovingAdjustments = storedAdjustments;
  let adjustmentsChanged = false;
  // "Use new price": the move's answers priced at today's catalog.
  const useCurrentPrices = body.useCurrentPrices === true;

  // Express and the deviation as the move's own lines: the stored ones unless
  // this save changes them (movingHandlingLines).
  const storedHandling = movingHandlingFromOrder(order);
  let handlingRows = storedMovingHandlingRows(order.items);
  let handlingRowsChanged = false;

  // "Handle order": the panel's fields and the calculator's amounts.
  if (body.handling !== undefined) {
    const parsed = parseWebsiteOrderHandling(body.handling, storedHandling);
    if (!parsed.ok) return reject(parsed.reason, 422, { errors: parsed.errors });
    const h = parsed.handling;
    if (movingHandlingLinesChanged(storedHandling, h)) {
      const catalog = await getMovingCatalog();
      if (!catalog) return reject("CATALOG_UNAVAILABLE", 500);
      handlingRows = movingHandlingItemRows(catalog.handlingRates, h);
      handlingRowsChanged = true;
      Object.assign(data, { expressDelivery: h.expressDelivery, deviation: h.deviation || null });
    }
    Object.assign(data, {
      driver: h.driver || null,
      secondDriver: h.secondDriver || null,
      driverInfo: h.driverInfo || null,
      licensePlate: h.licensePlate || null,
      description: h.description || null,
      deliveryDate: h.deliveryDate || null,
      timeWindow: h.timeWindow || null,
    });
    const amounts = {
      rabatt: h.rabatt || null,
      leggTil: h.leggTil || null,
      subcontractorMinus: h.subcontractorMinus || null,
      subcontractorPlus: h.subcontractorPlus || null,
    };
    if ((Object.keys(amounts) as (keyof typeof amounts)[]).some((key) => amounts[key] !== (storedAdjustments[key] ?? null))) {
      adjustmentsChanged = true;
      adjustments = { ...adjustments, ...amounts };
      Object.assign(data, amounts);
    }
  }

  // The calculator's "Set to 0" boxes (a move's card and its order extras).
  if (body.nulledLines !== undefined) {
    const parsed = parseNulledLines(body.nulledLines);
    if (!parsed) return reject("INVALID_NULLED_LINES", 422);
    const nulledLines = movingNulledFromDraft(parsed);
    const sorted = (keys: string[]) => JSON.stringify([...keys].sort());
    const stored = storedAdjustments.nulledLines;
    if (sorted(nulledLines.customer) !== sorted(stored.customer) || sorted(nulledLines.subcontractor) !== sorted(stored.subcontractor)) {
      adjustmentsChanged = true;
      adjustments = { ...adjustments, nulledLines };
    }
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

  // Private or business (the Edit tab's customer card) — only what the
  // customer is shown (VAT display); it never changes the price.
  const storedDetails = parseMovingBookingDetails(order.websiteBookingDetails);
  let customerType = storedDetails?.customerType ?? null;
  if (body.customerType !== undefined) {
    if (body.customerType !== "private" && body.customerType !== "business") {
      return reject("INVALID_DETAILS", 422, { errors: { customerType: "Invalid" } });
    }
    customerType = body.customerType;
  }

  // The move itself, re-priced from the catalog: an edit, or "Use new price"
  // on the move as it is.
  let save: ReturnType<typeof movingOrderSaveData> | null = null;
  // The lines a save without an edit writes (express/deviation changed).
  let lineRows: (typeof order.items)[number][] | null = null;
  if (body.edit !== undefined || useCurrentPrices) {
    const before = movingEditFromOrder(order);
    const parsed = parseMovingEdit(body.edit !== undefined ? body.edit : before);
    if (!parsed.ok) return reject("INVALID_DETAILS", 422, { errors: parsed.errors });
    const addressesMoved =
      !before ||
      before.pickupAddress.trim() !== parsed.edit.pickupAddress ||
      before.deliveryAddress.trim() !== parsed.edit.deliveryAddress;
    const drivingDistance = addressesMoved
      ? await lookUpMovingDrivingDistance(parsed.edit.pickupAddress, parsed.edit.deliveryAddress)
      : order.drivingDistance ?? "";

    const catalog = await getMovingCatalog();
    if (!catalog) return reject("CATALOG_UNAVAILABLE", 500);
    // As with a delivery: an edit re-prices at today's catalog, so a move
    // saved at older prices needs "Use new price" chosen first.
    if (!useCurrentPrices && movingPricesOutdated(catalog, order)) {
      return reject("PRICES_OUTDATED", 409, { storedPriceExVat: order.priceExVat });
    }
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
      customerType,
      adjustments,
      handlingRows,
    });
  } else if (handlingRowsChanged) {
    // Express or the deviation changed: the stored move with its new lines.
    const itemRows = [...order.items.filter((item) => !isMovingHandlingItem(item)), ...handlingRows];
    lineRows = itemRows;
    Object.assign(data, movingOrderAdjustedPricing(itemRows, adjustments));
  } else if (adjustmentsChanged) {
    // Only the amounts changed: the stored lines, re-priced with them.
    Object.assign(data, movingOrderAdjustedPricing(order.items, adjustments));
  }
  // A new customer type on a move that isn't re-priced: just its answers.
  if (!save && storedDetails && customerType !== storedDetails.customerType) {
    data.websiteBookingDetails = { ...(order.websiteBookingDetails as Record<string, unknown>), customerType };
  }

  // The order after this save, against what was paid.
  const after = { ...order, ...data, ...(save?.orderData ?? {}) } as typeof order;
  const comparison = compareOrderWithPayments({ payments: order.payments, current: buildOrderStateSnapshot(after) });
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      previousPriceExVat: order.priceExVat,
      priceExVat: after.priceExVat,
      comparison,
      // The admin calculator as it would read after this save (WebsiteOrderCalculator).
      calculator: movingOrderCalculatorView(save?.itemRows ?? lineRows ?? order.items, adjustments, { includePartner: true }),
    });
  }

  try {
    if (save) await prisma.$transaction(movingOrderSaveWrites(order.id, save, data));
    else if (lineRows) await prisma.$transaction(movingOrderItemWrites(order.id, lineRows, data));
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
