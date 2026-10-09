import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCustomerSession } from "@/lib/customerAccounts/customerSession";
import {
  customerOrderDetails,
  customerOrderTotalIncVatNok,
  customerOrderView,
  findCustomerOrder,
  type CustomerOrder,
} from "@/lib/customerAccounts/customerOrderView";
import { getWebsiteOrderCatalog, listSeededWebsiteCatalogs } from "@/lib/content/websiteOrderCatalog";
import { usesFullDistanceKmPricing } from "@/lib/booking/pricing/distanceCharges";
import { getPricingSnapshotCustomDeviationDescription, getPricingSnapshotCustomDeviationPrice } from "@/lib/orders/orderTotals";
import { isTimeWindowComplete } from "@/lib/booking/timeWindows";
import {
  classifyCustomerOrderEdit,
  findForbiddenChanges,
  isAllowedNewSchedule,
  type CustomerEditCard,
  type CustomerEditState,
} from "@/lib/orders/customerOrderEditPolicy";
import { buildDetailsUpdate, parseAdminOrderDetails, type AdminOrderDetails } from "@/lib/orders/websiteOrderDetailsEdit";
import { validateWebsiteOrderCards } from "@/lib/orders/validateWebsiteOrderCards";
import { resolveDrivingDistance } from "@/lib/orders/resolveDrivingDistance";
import {
  ItemNameRequiredError,
  SizeBracketSelectionError,
  recomputeWebsiteOrderPricing,
  websiteOrderPricingWrites,
} from "@/lib/orders/websiteOrderRepricing";
import { buildOrderStateSnapshot, diffOrderStates, type OrderStateSource } from "@/lib/orders/paidOrderSnapshot";
import { describeDetailChange, describeLineChange, formatKr, type ChangeLocale } from "@/lib/orders/orderChangeText";
import { createOrderUpdatedEvent, type OrderEventChange } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";
import { validateEmailField, validatePhoneField, validateTextField } from "@/lib/orders/websiteOrderValidation";
import { normalizeSavedProductCard, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// "My order": a logged-in customer reads (GET) and changes (PUT) their own
// homepage order. What may change when is lib/orders/customerOrderEditPolicy.ts
// — checked here against every request, whatever the page allowed. A change
// is re-priced through the same pipeline as the admin editor
// (websiteOrderRepricing), saved straight away, and staff are told (order
// notification + history) so the crew can confirm it with the office. The
// customer gets an order_updated email as their record.
//
// PUT body (every part optional — what's left out stays as it is):
//   { customer: { name, phone, email, comments }, preferredDate, timeWindow,
//     pickups, delivery, productCards, shownTotal, dryRun }
// A change that moves the price needs `shownTotal` = the price the page
// showed (from a dryRun); anything else is refused with the real price, same
// contract as the order POST. Payment (Stripe) is not part of this yet — the
// existing pay page charges whatever the order totals.

type Params = { params: Promise<{ orderNumber: string }> };

const ACTOR = { source: "SYSTEM", name: "Customer" } as const;

function reject(reason: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, reason, ...extra }, { status });
}

async function load(req: Request, params: Params["params"]) {
  const session = await getCustomerSession(req);
  if (!session) return { ok: false as const, response: reject("UNAUTHORIZED", 401) };
  const { orderNumber } = await params;
  const order = await findCustomerOrder(session.accountId, decodeURIComponent(orderNumber));
  if (!order) return { ok: false as const, response: reject("NOT_FOUND", 404) };
  return { ok: true as const, order };
}

// Cards in their full shape (every field present), on both sides of a
// comparison — so a card the page sends back untouched isn't a change.
function normalizedCards(cards: unknown): SavedProductCard[] {
  return Array.isArray(cards) ? cards.map((card, index) => normalizeSavedProductCard(card as SavedProductCard, index)) : [];
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const loaded = await load(req, params);
  if (!loaded.ok) return loaded.response;
  const { order } = loaded;

  const view = customerOrderView(order);
  if (!view.permissions.canEditItems) return NextResponse.json({ ok: true, ...view });

  const [catalog, seeded] = await Promise.all([getWebsiteOrderCatalog(), listSeededWebsiteCatalogs()]);
  const idByCode = new Map(catalog.products.map((p) => [p.code, p.id]));
  return NextResponse.json({
    ok: true,
    ...view,
    productCards: normalizedCards(order.productCardsSnapshot),
    drivingDistance: order.drivingDistance,
    // What else is in the price, so the page's live summary matches the
    // server (staff-set discount/extra/deviation/express). The partner side
    // is left out.
    pricingContext: {
      expressDelivery: order.expressDelivery,
      rabatt: order.rabatt ?? "",
      leggTil: order.leggTil ?? "",
      deviation: order.deviation ?? "",
      customDeviation: {
        price: getPricingSnapshotCustomDeviationPrice(order.pricingSnapshot),
        description: getPricingSnapshotCustomDeviationDescription(order.pricingSnapshot),
      },
      useFullDistanceKmPricing: usesFullDistanceKmPricing(order.createdAt),
    },
    catalog: { products: catalog.products, specialOptions: catalog.specialOptions, priceListSettings: catalog.priceListSettings },
    categories: seeded.map(({ catalog: list }) => ({
      code: list.priceListCode,
      productIds: list.products.flatMap((p) => idByCode.get(p.code) ?? []),
    })),
  });
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

export async function PUT(req: Request, { params }: Params): Promise<NextResponse> {
  const loaded = await load(req, params);
  if (!loaded.ok) return loaded.response;
  const { order } = loaded;
  const now = new Date();

  const body = record(await req.json().catch(() => null));
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
      customer: { ...customer, customerType: details.customer.customerType },
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

  const kinds = classifyCustomerOrderEdit(beforeState, afterState);
  if (kinds.length === 0) return NextResponse.json({ ok: true, changed: false, priceExVat: order.priceExVat });

  const forbidden = findForbiddenChanges(kinds, permissions);
  if (forbidden.length > 0) return reject("EDIT_NOT_ALLOWED", 403, { forbidden });

  if (kinds.includes("schedule") && (!isTimeWindowComplete(timeWindow) || !isAllowedNewSchedule(preferredDate, timeWindow, now))) {
    return reject("INVALID_SCHEDULE", 422);
  }

  // The order after the change, as the snapshot/notification code reads it.
  let afterOrder: OrderStateSource & { productsSummary?: string | null };
  const before = { ...order };

  if (afterDetails) {
    let cards = submittedCards ?? beforeCards;
    if (submittedCards) {
      const catalog = await getWebsiteOrderCatalog();
      const check = validateWebsiteOrderCards(submittedCards, catalog.products, { previousCards: normalizedCards(order.productCardsSnapshot) });
      if (!check.ok) return reject(check.reason, 422);
      cards = check.cards;
    }

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
      recomputed = await recomputeWebsiteOrderPricing(pricedOrder, cards);
    } catch (err) {
      if (err instanceof SizeBracketSelectionError) return reject("SIZE_BRACKETS_REQUIRED", 422);
      if (err instanceof ItemNameRequiredError) return reject("ITEM_NAME_REQUIRED", 422);
      console.error("[customer order] Failed to re-price order:", err);
      return reject("UPDATE_FAILED", 500);
    }

    const previousPriceExVat = order.priceExVat;
    // Refunds aren't built: once something is paid the order can't get cheaper here.
    if (recomputed.priceExVat < previousPriceExVat && order.payments.length > 0) return reject("WOULD_DECREASE_PRICE", 422);

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, previousPriceExVat, priceExVat: recomputed.priceExVat });
    }

    if (recomputed.priceExVat !== previousPriceExVat) {
      if (shownTotal === null) return reject("SHOWN_TOTAL_REQUIRED", 400);
      if (Math.abs(shownTotal - recomputed.priceExVat) >= 0.5) {
        return reject("PRICE_CHANGED", 409, { priceExVat: recomputed.priceExVat });
      }
    }

    try {
      await prisma.$transaction(
        websiteOrderPricingWrites({ id: order.id, websiteBookingDetails: pricedOrder.websiteBookingDetails }, recomputed, {
          ...detailsUpdate.orderData,
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
  } else {
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, previousPriceExVat: order.priceExVat, priceExVat: order.priceExVat });
    }
    const data = {
      customerName: customer.name,
      phone: customer.phone,
      email: customer.email,
      customerComments: customer.comments || null,
      deliveryDate: preferredDate || null,
      timeWindow: timeWindow || null,
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
  const staffLines = describeChanges(states.before, states.after, "en");
  const customerLines = describeChanges(states.before, states.after, "no");
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

  await afterSave(async () => {
    const message = [
      `The customer changed their order themselves in "My order":`,
      ...staffLines.map((line) => `• ${line}`),
      deltaExVat !== 0 ? `Total ${deltaExVat > 0 ? "increased" : "decreased"} by ${formatKr(Math.abs(deltaExVat))}.` : "Total unchanged.",
      ...(order.gsmSentAt ? ["Already sent to GSM — update the task."] : []),
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

  return NextResponse.json({
    ok: true,
    changed: true,
    previousPriceExVat: order.priceExVat,
    priceExVat: afterOrder.priceExVat,
    changes: customerLines,
    details: customerOrderDetails({ ...order, ...afterOrder } as CustomerOrder),
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
