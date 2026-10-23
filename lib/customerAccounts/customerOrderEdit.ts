import { prisma } from "@/lib/db";
import {
  customerOrderDetails,
  customerOrderTotalIncVatNok,
  customerOrderView,
  type CustomerOrder,
} from "@/lib/customerAccounts/customerOrderView";
import { getWebsiteOrderCatalog } from "@/lib/content/websiteOrderCatalog";
import { isTimeWindowComplete } from "@/lib/booking/timeWindows";
import {
  classifyCustomerOrderEdit,
  findForbiddenChanges,
  isAllowedNewSchedule,
  type CustomerEditCard,
  type CustomerEditKind,
  type CustomerEditState,
} from "@/lib/orders/customerOrderEditPolicy";
import { getMovingCatalog } from "@/lib/content/getMovingCatalog";
import { lookUpMovingDrivingDistance } from "@/lib/orders/movingDrivingDistance";
import { classifyMovingEdit, movingOrderSaveData, parseMovingEdit } from "@/lib/orders/movingOrderEdit";
import { priceMovingOrder } from "@/lib/orders/movingOrderQuote";
import { movingAdjustmentsFromOrder } from "@/lib/orders/movingOrderCalculator";
import { movingOrderSaveWrites } from "@/lib/orders/movingOrderWrites";
import { storedMovingHandlingRows } from "@/lib/orders/movingHandlingLines";
import {
  classifyServiceEdit,
  parseServiceEdit,
  serviceAnswersOf,
  serviceEditFromOrder,
  serviceOrderSaveData,
  type ServiceAnswers,
} from "@/lib/orders/serviceOrderEdit";
import { serviceOrderItemWrites } from "@/lib/orders/serviceOrderWrites";
import { serviceRequestLabel } from "@/lib/content/serviceRequestCatalog";
import { buildDetailsUpdate, parseAdminOrderDetails, type AdminOrderDetails } from "@/lib/orders/websiteOrderDetailsEdit";
import { validateWebsiteOrderCards } from "@/lib/orders/validateWebsiteOrderCards";
import { findCardsWithoutPickup, findPickupsWithoutProducts } from "@/lib/orders/pickupAssignment";
import { resolveDrivingDistance } from "@/lib/orders/resolveDrivingDistance";
import {
  ItemNameRequiredError,
  SizeBracketSelectionError,
  recomputeWebsiteOrderPricing,
  resolveSavedCatalogPricing,
  websiteOrderPricingWrites,
} from "@/lib/orders/websiteOrderRepricing";
import { buildOrderStateSnapshot, diffOrderStates, type OrderStateSource } from "@/lib/orders/paidOrderSnapshot";
import { describeDetailChange, describeLineChange, formatKr, type ChangeLocale } from "@/lib/orders/orderChangeText";
import { createOrderStatusChangedEvent, createOrderUpdatedEvent, type OrderEventChange } from "@/lib/orders/orderEvents";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { sumOrderPayments } from "@/lib/orders/orderPayments";
import { decidePaidOrderChange } from "@/lib/customerAccounts/paidOrderChange";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";
import { validateEmailField, validatePhoneField, validateTextField } from "@/lib/orders/websiteOrderValidation";
import { normalizeSavedProductCard, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// A customer changing their own homepage order in "My order" — the PUT of
// app/api/customer/orders/[orderNumber], and (mode "paid") applying a change
// they have already paid for (customerOrderPaidChange.ts). What may change
// when is lib/orders/customerOrderEditPolicy.ts — checked here against every
// request, whatever the page allowed. A change is re-priced through the same
// pipeline as the admin editor (websiteOrderRepricing), saved, and staff are
// told (order notification + history) so the crew can confirm it with the
// office. The customer gets an order_updated email as their record.
//
// A change that moves the price needs `shownTotal` = the price the page
// showed (from a dryRun); anything else is refused with the real price. On a
// paid order a dearer change isn't saved but returned as `payFirst`, and a
// cheaper one is only allowed before the cutoff (paidOrderChange.ts).

const ACTOR = { source: "SYSTEM", name: "Customer" } as const;

// What the route sends back: the HTTP status and JSON body. `payFirst` is set
// when the change is held until the customer pays (see paidOrderChange.ts).
export type CustomerOrderEditResult = {
  status: number;
  json: Record<string, unknown>;
  payFirst?: { amountDueCents: number; totalIncVat: number };
};

function reject(reason: string, status: number, extra: Record<string, unknown> = {}): CustomerOrderEditResult {
  return { status, json: { ok: false, reason, ...extra } };
}

function done(json: Record<string, unknown>): CustomerOrderEditResult {
  return { status: 200, json };
}

// Cards in their full shape (every field present), on both sides of a
// comparison — so a card the page sends back untouched isn't a change.
export function normalizedCards(cards: unknown): SavedProductCard[] {
  return Array.isArray(cards) ? cards.map((card, index) => normalizeSavedProductCard(card as SavedProductCard, index)) : [];
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// The customer's contact fields are all required (unlike the admin editor,
// which may save an incomplete order).
function contactErrors(customer: CustomerEditState["customer"]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!customer.name) errors["customer.name"] = "Required";
  else if (validateTextField(customer.name)) errors["customer.name"] = "Contains disallowed characters";
  const phoneError = validatePhoneField(customer.phone);
  if (phoneError) errors["customer.phone"] = phoneError;
  if (!customer.email) errors["customer.email"] = "Required";
  else {
    const emailError = validateEmailField(customer.email);
    if (emailError) errors["customer.email"] = emailError;
  }
  if (validateTextField(customer.comments)) errors["customer.comments"] = "Contains disallowed characters";
  return errors;
}

const CONTACT_LABELS: Record<keyof CustomerEditState["customer"], Record<ChangeLocale, string>> = {
  name: { no: "Navn", en: "Name" },
  phone: { no: "Telefon", en: "Phone" },
  email: { no: "E-post", en: "Email" },
  comments: { no: "Kommentar", en: "Comment" },
};

// The change in words, for staff ("en") and the customer's email ("no").
function describeChanges(
  before: { state: CustomerEditState; snapshot: OrderStateSource },
  after: { state: CustomerEditState; snapshot: OrderStateSource },
  locale: ChangeLocale,
): string[] {
  const contact = (Object.keys(CONTACT_LABELS) as (keyof CustomerEditState["customer"])[])
    .filter((key) => before.state.customer[key] !== after.state.customer[key])
    .map((key) => `${CONTACT_LABELS[key][locale]}: ${before.state.customer[key] || "–"} → ${after.state.customer[key] || "–"}`);
  const { lineChanges, detailChanges } = diffOrderStates(buildOrderStateSnapshot(before.snapshot), buildOrderStateSnapshot(after.snapshot));
  return [
    ...contact,
    ...detailChanges.map((change) => describeDetailChange(change, locale)),
    ...lineChanges.map((change) => describeLineChange(change, locale)),
  ];
}

// A service request's services and their job descriptions in words — what
// was added, removed or described differently (the address is already among
// the order's detail changes).
function describeServiceChanges(before: ServiceAnswers, after: ServiceAnswers, locale: ChangeLocale): string[] {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const key = (service: ServiceAnswers["services"][number]) => `${service.serviceCode}:${service.customService.trim()}`;
  const label = (service: ServiceAnswers["services"][number]) =>
    serviceRequestLabel(service.serviceCode, service.customService, locale) ?? service.serviceCode;
  const lines: string[] = [];
  for (const service of before.services) {
    if (!after.services.some((s) => key(s) === key(service))) lines.push(`${t("Service removed", "Tjeneste fjernet")}: ${label(service)}`);
  }
  for (const service of after.services) {
    const was = before.services.find((s) => key(s) === key(service));
    if (!was) lines.push(`${t("Service added", "Tjeneste lagt til")}: ${label(service)} — ${service.jobDescription}`);
    else if (was.jobDescription.trim() !== service.jobDescription.trim()) {
      lines.push(`${label(service)} — ${t("what needs doing", "hva skal gjøres")}: ${was.jobDescription || "–"} → ${service.jobDescription || "–"}`);
    }
  }
  return lines;
}

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
] as const;

type LoggedOrder = Partial<Record<(typeof LOGGED_FIELDS)[number][0], string | null>> & { priceExVat: number };

function eventChanges(before: LoggedOrder, after: LoggedOrder): OrderEventChange[] {
  const changes: OrderEventChange[] = LOGGED_FIELDS.filter(([field]) => (before[field] ?? "") !== (after[field] ?? "")).map(
    ([field, label]) => ({ field, label, previousValue: before[field] ?? "", nextValue: after[field] ?? "" }),
  );
  if (before.priceExVat !== after.priceExVat) {
    changes.push({ field: "priceExVat", label: "Price", previousValue: String(before.priceExVat), nextValue: String(after.priceExVat) });
  }
  return changes;
}

// "My order" PUT, for the route and — mode "paid" — for applying a change
// the customer has already paid for (customerOrderPaidChange.ts).
export async function editCustomerOrder(
  order: CustomerOrder,
  rawBody: unknown,
  options: { now: Date; mode: "customer" | "paid" },
): Promise<CustomerOrderEditResult> {
  const { now, mode } = options;
  const body = record(rawBody);
  const dryRun = body.dryRun === true;
  const shownTotal = typeof body.shownTotal === "number" && Number.isFinite(body.shownTotal) ? body.shownTotal : null;
  if (body.productCards !== undefined && !Array.isArray(body.productCards)) return reject("INVALID_BODY", 400);

  const view = customerOrderView(order, now);
  const { permissions, details } = view;
  if (!permissions.open) return reject("ORDER_CLOSED", 409);

  // Before and after, as the edit policy compares them.
  const sentCustomer = record(body.customer);
  const customer = {
    name: text(sentCustomer.name, details.customer.name),
    phone: text(sentCustomer.phone, details.customer.phone),
    email: text(sentCustomer.email, details.customer.email),
    comments: text(sentCustomer.comments, details.customer.comments),
  };
  const preferredDate = text(body.preferredDate, details.preferredDate);
  const timeWindow = text(body.timeWindow, details.timeWindow);
  const beforeCards = permissions.canEditItems ? normalizedCards(order.productCardsSnapshot) : [];
  const submittedCards = Array.isArray(body.productCards) ? normalizedCards(body.productCards) : undefined;

  const contactProblems = contactErrors(customer);
  if (Object.keys(contactProblems).length > 0) return reject("INVALID_DETAILS", 422, { errors: contactProblems });

  // A catalog order's full details, run through the same parser as the admin
  // editor (formats, stop limits). The distance is never the customer's.
  let afterDetails: AdminOrderDetails | null = null;
  if (details.kind === "catalog") {
    const parsed = parseAdminOrderDetails({
      ...details,
      // The org number isn't editable on "My order" — the stored one is kept.
      customer: { ...customer, customerType: details.customer.customerType, orgNumber: details.customer.orgNumber },
      preferredDate,
      timeWindow,
      pickups: body.pickups !== undefined ? body.pickups : details.pickups,
      delivery: body.delivery !== undefined ? body.delivery : details.delivery,
      drivingDistanceOverride: null,
    });
    if (!parsed.ok) return reject(parsed.reason, 422, { errors: parsed.errors });
    afterDetails = parsed.details;
  }
  const beforeDetails = details.kind === "catalog" ? parseAdminOrderDetails({ ...details, drivingDistanceOverride: null }) : null;

  const beforeState: CustomerEditState = {
    customer: {
      name: details.customer.name,
      phone: details.customer.phone,
      email: details.customer.email,
      comments: details.customer.comments,
    },
    preferredDate: details.preferredDate,
    timeWindow: details.timeWindow,
    pickups: beforeDetails?.ok ? beforeDetails.details.pickups : [],
    delivery: beforeDetails?.ok ? beforeDetails.details.delivery : undefined,
    cards: beforeCards as unknown as CustomerEditCard[],
  };
  const afterState: CustomerEditState = {
    customer,
    preferredDate,
    timeWindow,
    pickups: afterDetails ? afterDetails.pickups : body.pickups !== undefined ? (body.pickups as AdminOrderDetails["pickups"]) : undefined,
    delivery: afterDetails ? afterDetails.delivery : body.delivery !== undefined ? (body.delivery as AdminOrderDetails["delivery"]) : undefined,
    cards: submittedCards as unknown as CustomerEditCard[] | undefined,
  };

  // A move: the whole move as edited (addresses, both ends, services), in a
  // delivery order's change kinds — so the same 24h policy applies.
  let movingEdit: Extract<ReturnType<typeof parseMovingEdit>, { ok: true }> | null = null;
  const movingKinds: CustomerEditKind[] = [];
  if (details.kind === "moving" && body.moving !== undefined) {
    const parsed = parseMovingEdit(body.moving);
    if (!parsed.ok) return reject("INVALID_DETAILS", 422, { errors: parsed.errors });
    movingKinds.push(...classifyMovingEdit(details.moving, parsed.edit));
    if (movingKinds.length > 0) movingEdit = parsed;
  }

  // A service request: its services, their jobs and the address as edited
  // (classifyServiceEdit), each service keeping staff's quote — a new one
  // has none yet.
  let serviceSave: ReturnType<typeof serviceOrderSaveData> | null = null;
  let serviceAfter: ServiceAnswers | null = null;
  const serviceKinds: CustomerEditKind[] = [];
  if (details.kind === "service" && body.service !== undefined) {
    const stored = serviceEditFromOrder(order);
    const sent = record(body.service);
    const sentServices = Array.isArray(sent.services) ? sent.services : [];
    const withQuotes = sentServices.map((entry) => {
      const service = record(entry);
      const quote = stored?.services.find((s) => s.serviceCode === service.serviceCode)?.quote ?? { customer: null, partner: null };
      return { ...service, quote };
    });
    const parsed = stored ? parseServiceEdit({ address: sent.address, services: withQuotes }) : null;
    if (!parsed?.ok) return reject("INVALID_DETAILS", 422, { errors: parsed && !parsed.ok ? parsed.errors : {} });
    serviceAfter = serviceAnswersOf(parsed.edit);
    serviceKinds.push(...classifyServiceEdit(details.service, serviceAfter));
    if (serviceKinds.length > 0) {
      serviceSave = serviceOrderSaveData({
        parsed,
        customerType: details.customerType,
        // Discount/extra, partner minus/plus, lines set to 0 and express/deviation, as staff left them.
        adjustments: movingAdjustmentsFromOrder(order),
        handlingRows: storedMovingHandlingRows(order.items),
      });
    }
  }

  const kinds = [...classifyCustomerOrderEdit(beforeState, afterState), ...movingKinds, ...serviceKinds];
  if (kinds.length === 0) return done({ ok: true, changed: false, priceExVat: order.priceExVat });

  const forbidden = findForbiddenChanges(kinds, permissions);
  if (forbidden.length > 0) return reject("EDIT_NOT_ALLOWED", 403, { forbidden });

  if (kinds.includes("schedule") && (!isTimeWindowComplete(timeWindow) || !isAllowedNewSchedule(preferredDate, timeWindow, now))) {
    return reject("INVALID_SCHEDULE", 422);
  }

  // A rejected order "needs a change": once the customer has made one it goes
  // back to the review queue, saved together with the change itself.
  const wasRejected = normalizeOrderStatus(order.status) === "rejected";
  // A paid confirmed order that got cheaper goes back too (set by priceGate),
  // so staff review it — the refund goes out when they confirm it again.
  let reopenForRefund = false;
  const reopenData = () => (wasRejected || reopenForRefund ? { status: "processing", statusChangedAt: now } : {});

  // Every priced change: what a paid order allows (paidOrderChange.ts —
  // dearer is paid first, cheaper only before the cutoff), the dryRun answer
  // and the shown-price check. Returns the response to send, or null to save.
  const netPaidCents = sumOrderPayments(order.payments);
  const overpaidBy = (totalIncVat: number) => Math.round(netPaidCents - totalIncVat * 100) / 100;
  function priceGate(
    previousPriceExVat: number,
    priceExVat: number,
    previousTotalIncVat: number | null,
    totalIncVat: number,
  ): CustomerOrderEditResult | null {
    const decision = decidePaidOrderChange({
      netPaidCents,
      previousPriceExVat,
      priceExVat,
      totalIncVat,
      beforeCutoff: permissions.beforeCutoff,
      status: order.status,
      mode,
    });
    if (decision.action === "reject") return reject(decision.reason, 422);
    if (dryRun) {
      return done({
        ok: true,
        dryRun: true,
        previousPriceExVat,
        priceExVat,
        previousTotalIncVat,
        totalIncVat,
        // What the customer pays before the change is made.
        ...(decision.action === "payFirst" ? { payNowIncVat: decision.amountDueCents / 100 } : {}),
        // What they get back once staff have reviewed a cheaper paid order.
        ...(decision.action === "save" && decision.reopen ? { refundOnReviewIncVat: overpaidBy(totalIncVat) } : {}),
      });
    }
    if (priceExVat !== previousPriceExVat) {
      if (shownTotal === null) return reject("SHOWN_TOTAL_REQUIRED", 400);
      if (Math.abs(shownTotal - totalIncVat) >= 0.5) return reject("PRICE_CHANGED", 409, { priceExVat, totalIncVat });
    }
    if (decision.action === "payFirst") {
      return {
        status: 200,
        json: { ok: true, paymentRequired: true, amountDueIncVat: decision.amountDueCents / 100, totalIncVat },
        payFirst: { amountDueCents: decision.amountDueCents, totalIncVat },
      };
    }
    reopenForRefund = decision.reopen;
    return null;
  }

  // The order after the change, as the snapshot/notification code reads it.
  let afterOrder: OrderStateSource & { productsSummary?: string | null };
  const before = { ...order };

  if (afterDetails) {
    // Loaded once: checking the products and every pricing below use it.
    const catalog = await getWebsiteOrderCatalog();
    let cards = submittedCards ?? beforeCards;
    if (submittedCards) {
      const check = validateWebsiteOrderCards(submittedCards, catalog.products, { previousCards: normalizedCards(order.productCardsSnapshot) });
      if (!check.ok) return reject(check.reason, 422);
      cards = check.cards;
    }

    const withoutPickup = findCardsWithoutPickup(afterDetails.pickups, cards);
    if (withoutPickup.length > 0) return reject("PRODUCT_WITHOUT_PICKUP", 422, { cardIds: withoutPickup });
    // Only checked when the stops change, so an older order that already has
    // an empty one can still change e.g. its contact details.
    const emptyPickups = kinds.includes("addresses") ? findPickupsWithoutProducts(afterDetails.pickups) : [];
    if (emptyPickups.length > 0) return reject("PICKUP_WITHOUT_PRODUCT", 422, { pickups: emptyPickups });

    const drivingDistance = await resolveDrivingDistance(order, afterDetails);
    const detailsUpdate = buildDetailsUpdate({
      details: afterDetails,
      drivingDistance,
      storedBookingDetails: order.websiteBookingDetails,
      storedDescription: order.description,
    });
    const pricedOrder = { ...order, ...detailsUpdate.orderData, websiteBookingDetails: detailsUpdate.bookingDetails };

    let recomputed;
    try {
      // The order keeps the prices it was saved with; only what's new is priced
      // at today's catalog (resolveSavedCatalogPricing, like the admin editor).
      const catalogPricing = await resolveSavedCatalogPricing(order, normalizedCards(order.productCardsSnapshot), order.items, { catalog });
      recomputed = await recomputeWebsiteOrderPricing(pricedOrder, cards, { catalogPricing, catalog });
    } catch (err) {
      if (err instanceof SizeBracketSelectionError) return reject("SIZE_BRACKETS_REQUIRED", 422);
      if (err instanceof ItemNameRequiredError) return reject("ITEM_NAME_REQUIRED", 422);
      console.error("[customer order] Failed to re-price order:", err);
      return reject("UPDATE_FAILED", 500);
    }
    if (recomputed.missingPriceCardIds?.length) {
      console.error("[customer order] Prices missing for cards", recomputed.missingPriceCardIds);
      return reject("PRICING_INCOMPLETE", 409);
    }

    // Prices are ex. VAT; the customer is shown — and confirms — the totals
    // incl. VAT (summed per line, lib/booking/pricing/websiteVat.ts).
    const gate = priceGate(order.priceExVat, recomputed.priceExVat, customerOrderTotalIncVatNok(order), recomputed.customerTotals.totalIncVat);
    if (gate) return gate;

    try {
      await prisma.$transaction(
        websiteOrderPricingWrites({ id: order.id, websiteBookingDetails: pricedOrder.websiteBookingDetails }, recomputed, {
          ...detailsUpdate.orderData,
          ...reopenData(),
        }),
      );
    } catch (err) {
      console.error("[customer order] Failed to save order:", err);
      return reject("UPDATE_FAILED", 500);
    }

    afterOrder = {
      ...pricedOrder,
      priceExVat: recomputed.priceExVat,
      pricingSnapshot: recomputed.pricingSnapshot,
      websiteBookingDetails: { ...detailsUpdate.bookingDetails, orderExtras: recomputed.orderExtras },
      productsSummary: (recomputed.summaries as { productsSummary?: string | null }).productsSummary ?? order.productsSummary,
    };
  } else if (movingEdit && details.kind === "moving") {
    // Re-priced from the moving catalog like a booking; the distance is
    // looked up again only when an address moved (never the customer's).
    const drivingDistance = kinds.includes("addresses")
      ? await lookUpMovingDrivingDistance(movingEdit.edit.pickupAddress, movingEdit.edit.deliveryAddress)
      : order.drivingDistance ?? "";
    const catalog = await getMovingCatalog();
    if (!catalog) return reject("UPDATE_FAILED", 500);
    const quote = priceMovingOrder(catalog, {
      origin: movingEdit.origin,
      destination: movingEdit.destination,
      serviceCodes: movingEdit.edit.serviceCodes,
      drivingDistance,
    });
    if (!quote.ok) return reject("INVALID_DETAILS", 422, { errors: quote.errors });

    // Re-priced with any discount/extra staff gave the move (admin calculator).
    const save = movingOrderSaveData({
      quote,
      parsed: movingEdit,
      drivingDistance,
      notes: customer.comments || null,
      customerType: details.customerType,
      // Discount/extra, partner minus/plus and lines set to 0, as staff left them.
      adjustments: movingAdjustmentsFromOrder(order),
      // Express and the deviation staff added, kept as priced.
      handlingRows: storedMovingHandlingRows(order.items),
    });
    const gate = priceGate(
      order.priceExVat,
      save.pricing.priceExVat,
      customerOrderTotalIncVatNok(order),
      save.pricing.pricingSnapshot.customer.totalIncVat,
    );
    if (gate) return gate;
    const contactAndSchedule = {
      customerName: customer.name,
      phone: customer.phone,
      email: customer.email,
      customerComments: customer.comments || null,
      deliveryDate: preferredDate || null,
      timeWindow: timeWindow || null,
    };
    try {
      await prisma.$transaction(movingOrderSaveWrites(order.id, save, { ...contactAndSchedule, ...reopenData() }));
    } catch (err) {
      console.error("[customer order] Failed to save the move:", err);
      return reject("UPDATE_FAILED", 500);
    }
    afterOrder = { ...order, ...contactAndSchedule, ...save.orderData };
  } else if (serviceSave) {
    // Staff's quotes are kept: the price only moves when a quoted service is
    // removed (its line goes); an added one waits for staff to quote it.
    const gate = priceGate(
      order.priceExVat,
      serviceSave.pricing.priceExVat,
      customerOrderTotalIncVatNok(order) ?? 0,
      serviceSave.pricing.pricingSnapshot.customer.totalIncVat,
    );
    if (gate) return gate;
    const contactAndSchedule = {
      customerName: customer.name,
      phone: customer.phone,
      email: customer.email,
      customerComments: customer.comments || null,
      deliveryDate: preferredDate || null,
      timeWindow: timeWindow || null,
    };
    try {
      await prisma.$transaction(serviceOrderItemWrites(order.id, serviceSave.itemRows, { ...serviceSave.orderData, ...contactAndSchedule, ...reopenData() }));
    } catch (err) {
      console.error("[customer order] Failed to save the service request:", err);
      return reject("UPDATE_FAILED", 500);
    }
    afterOrder = { ...order, ...contactAndSchedule, ...serviceSave.orderData };
  } else {
    if (dryRun) {
      const totalIncVat = customerOrderTotalIncVatNok(order);
      return done({
        ok: true,
        dryRun: true,
        previousPriceExVat: order.priceExVat,
        priceExVat: order.priceExVat,
        previousTotalIncVat: totalIncVat,
        totalIncVat,
      });
    }
    const data = {
      customerName: customer.name,
      phone: customer.phone,
      email: customer.email,
      customerComments: customer.comments || null,
      deliveryDate: preferredDate || null,
      timeWindow: timeWindow || null,
      ...reopenData(),
    };
    try {
      await prisma.order.update({ where: { id: order.id }, data });
    } catch (err) {
      console.error("[customer order] Failed to save order:", err);
      return reject("UPDATE_FAILED", 500);
    }
    afterOrder = { ...order, ...data };
  }

  const states = {
    before: { state: beforeState, snapshot: before },
    after: { state: afterState, snapshot: afterOrder },
  };
  const serviceLines = (locale: ChangeLocale) =>
    details.kind === "service" && serviceAfter ? describeServiceChanges(details.service, serviceAfter, locale) : [];
  const staffLines = [...describeChanges(states.before, states.after, "en"), ...serviceLines("en")];
  const customerLines = [...describeChanges(states.before, states.after, "no"), ...serviceLines("no")];
  const deltaExVat = afterOrder.priceExVat - order.priceExVat;
  const reference = order.orderNumber ?? String(order.displayId);

  await afterSave(async () => {
    await createOrderUpdatedEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor: ACTOR,
      changes: eventChanges(before, { ...afterOrder, customerName: customer.name, phone: customer.phone, email: customer.email, customerComments: customer.comments || null }),
    });
  });

  if (wasRejected || reopenForRefund) {
    await afterSave(async () => {
      await createOrderStatusChangedEvent(prisma, {
        orderId: order.id,
        companyId: order.companyId,
        actor: ACTOR,
        fromStatus: order.status,
        toStatus: "processing",
        note: wasRejected
          ? "The customer changed the rejected order."
          : "The customer made the paid order cheaper — back to processing for review.",
      });
    });
  }

  // A paid order that got cheaper: what the customer has overpaid.
  const overpaidIncVat = reopenForRefund ? overpaidBy(customerOrderTotalIncVatNok({ ...order, ...afterOrder }) ?? 0) : 0;

  await afterSave(async () => {
    const message = [
      `The customer changed their order themselves in "My order":`,
      ...staffLines.map((line) => `• ${line}`),
      deltaExVat !== 0 ? `Total ${deltaExVat > 0 ? "increased" : "decreased"} by ${formatKr(Math.abs(deltaExVat))}.` : "Total unchanged.",
      ...(order.gsmSentAt ? ["Already sent to GSM — update the task."] : []),
      ...(wasRejected ? ["The order was rejected, so it is back to processing for review."] : []),
      ...(reopenForRefund
        ? [
            `The order was paid and is now cheaper, so it is back to processing for review. The customer has overpaid ${formatKr(overpaidIncVat)} — it is refunded automatically when you set the order to confirmed again.`,
          ]
        : []),
    ].join("\n");
    await createOrderNotification(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      type: "MANUAL_REVIEW",
      title: `Customer edited order #${reference}`,
      message,
    });
  });

  await afterSave(async () => {
    await sendLifecycleEmailsForOrders({
      orders: [
        {
          ...order,
          customerName: customer.name,
          email: customer.email,
          orderUpdate: { changes: customerLines, totalIncVatNok: customerOrderTotalIncVatNok({ ...order, ...afterOrder }) },
        },
      ],
      kind: "order_updated",
      actor: ACTOR,
    });
  });

  return done({
    ok: true,
    changed: true,
    previousPriceExVat: order.priceExVat,
    priceExVat: afterOrder.priceExVat,
    // What the customer sees: incl. VAT.
    previousTotalIncVat: customerOrderTotalIncVatNok(order),
    totalIncVat: customerOrderTotalIncVatNok({ ...order, ...afterOrder }),
    changes: customerLines,
    details: customerOrderDetails({ ...order, ...afterOrder } as CustomerOrder),
    // Refunded once staff have reviewed it (a paid order made cheaper).
    ...(reopenForRefund ? { refundOnReviewIncVat: overpaidIncVat } : {}),
  });
}

// The order is already saved — history, staff alert and the email must not
// turn that into an error for the customer.
async function afterSave(step: () => Promise<void>) {
  try {
    await step();
  } catch (err) {
    console.error("[customer order] Follow-up after save failed:", err);
  }
}
