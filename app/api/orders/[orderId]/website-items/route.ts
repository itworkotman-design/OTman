import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";
import { getWebsiteOrderCatalog, listSeededWebsiteCatalogs } from "@/lib/content/websiteOrderCatalog";
import { findUnsellableProductIds } from "@/lib/content/mergeWebsiteCatalogs";
import { getRouteDistance } from "@/lib/integrations/mapbox/routeDistance";
import {
  ItemNameRequiredError,
  SizeBracketSelectionError,
  recomputeWebsiteOrderPricing,
  websiteOrderPricingWrites,
} from "@/lib/orders/websiteOrderRepricing";
import { planWebsiteOrderPaymentLink } from "@/lib/orders/websiteOrderPaymentLink";
import { buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { describeDetailChange, describeLineChange } from "@/lib/orders/orderChangeText";
import {
  buildDetailsUpdate,
  editableDetailsFromOrder,
  parseAdminOrderDetails,
  routeAddressesChanged,
} from "@/lib/orders/websiteOrderDetailsEdit";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import {
  applyNulledLinesToCards,
  parseNulledLines,
  websiteOrderCalculatorView,
} from "@/lib/orders/websiteOrderCalculator";
import { usesFullDistanceKmPricing } from "@/lib/booking/pricing/distanceCharges";
import {
  handlingFromOrder,
  handlingOrderData,
  parseWebsiteOrderHandling,
  scheduleBookingDetails,
  type WebsiteOrderHandling,
} from "@/lib/orders/websiteOrderHandling";
import { parseWhiteGoodsBookingDetails } from "@/lib/orders/websiteBookingDetails";
import { createOrderActionToken } from "@/lib/orders/orderActionToken";
import { createOrderUpdatedEvent, type OrderEventActor, type OrderEventChange } from "@/lib/orders/orderEvents";
import { resolveAllOrderNotifications } from "@/lib/orders/orderNotifications";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";
import {
  normalizeSavedProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// The admin editor in WebsiteOrderModal (e.g. the customer phones in): GET
// loads the order's product cards, its editable details (customer, pickup
// stops, delivery, date) and every website product grouped by category; PUT
// saves new products and/or details, re-priced through the same pipeline that
// created the order (see lib/orders/websiteOrderRepricing.ts).
//
// Every answer carries `comparison` — the order as it would be now against
// what the customer actually paid (compareOrderWithPayments): which lines and
// stops changed, and exactly how much is still due or must be refunded.
// `dryRun` returns just that preview without saving. With `sendPaymentLink`
// the customer also gets the existing payment email for the new total (see
// planWebsiteOrderPaymentLink), the balance-due one spelling out the
// difference; an order not yet approved is approved first.
//
// Unlike the customer's own edit link, the price may go down — an admin
// decides. Nothing is refunded automatically; the comparison flags it.

// Done or dead orders: products and addresses aren't changed any more. The
// admin's handling fields (driver, deviation, discount…) still are — those
// are often only known after the trip.
const LOCKED_STATUSES = new Set(["cancelled", "completed", "invoiced", "paid"]);

const ORDER_SELECT = {
  id: true,
  companyId: true,
  displayId: true,
  orderNumber: true,
  status: true,
  // The km rule depends on when the order was made (usesFullDistanceKmPricing).
  createdAt: true,
  customerName: true,
  customerLabel: true,
  statusNotes: true,
  phone: true,
  email: true,
  customerComments: true,
  description: true,
  driver: true,
  secondDriver: true,
  driverInfo: true,
  licensePlate: true,
  deviation: true,
  actionToken: true,
  emailThreadToken: true,
  paymentRequestSentAt: true,
  priceExVat: true,
  productsSummary: true,
  rabatt: true,
  leggTil: true,
  subcontractorMinus: true,
  subcontractorPlus: true,
  pricingSnapshot: true,
  pickupAddress: true,
  deliveryAddress: true,
  deliveryDate: true,
  timeWindow: true,
  drivingDistance: true,
  expressDelivery: true,
  floorNo: true,
  lift: true,
  extraPickupAddress: true,
  websiteOrderKind: true,
  websiteBookingDetails: true,
  productCardsSnapshot: true,
  payments: { select: { amountChargedCents: true, createdAt: true, orderSnapshot: true } },
} as const;

type Params = { params: Promise<{ orderId: string }> };

// Company owner/admin, or anyone with Website orders at ADMIN level.
async function authorize(req: Request) {
  const session = await getAuthenticatedSession(req);
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 }) };
  }
  if (!session.activeCompanyId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 }),
    };
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId: session.activeCompanyId, status: "ACTIVE" },
    select: { id: true, role: true, appAccess: true, user: { select: { username: true, email: true } } },
  });
  const websiteOrders = membership ? getModuleAccess(membership, "WEBSITE_ORDERS") : null;
  const canEdit =
    !!membership &&
    (membership.role === "OWNER" ||
      membership.role === "ADMIN" ||
      (!!websiteOrders?.enabled && websiteOrders.level === "ADMIN"));
  if (!membership || !canEdit) {
    return { ok: false as const, response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }) };
  }

  return { ok: true as const, companyId: session.activeCompanyId, membership };
}

async function findWhiteGoodsOrder(orderId: string, companyId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, companyId }, select: ORDER_SELECT });
  return order?.websiteOrderKind === "WHITE_GOODS" ? order : null;
}

type WebsiteOrder = NonNullable<Awaited<ReturnType<typeof findWhiteGoodsOrder>>>;

function storedCards(order: WebsiteOrder): SavedProductCard[] {
  return Array.isArray(order.productCardsSnapshot) ? (order.productCardsSnapshot as unknown as SavedProductCard[]) : [];
}

export async function GET(req: Request, { params }: Params) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  const order = await findWhiteGoodsOrder(orderId, auth.companyId);
  if (!order) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  try {
    const [catalog, seeded] = await Promise.all([getWebsiteOrderCatalog(), listSeededWebsiteCatalogs()]);
    const idByCode = new Map(catalog.products.map((p) => [p.code, p.id]));

    return NextResponse.json({
      ok: true,
      productCards: storedCards(order).map((card, index) => normalizeSavedProductCard(card, index)),
      customerType: parseWhiteGoodsBookingDetails(order.websiteBookingDetails)?.customerType ?? null,
      details: editableDetailsFromOrder(order),
      drivingDistance: order.drivingDistance,
      // Express/discount/extra/deviation — part of the price the editor shows.
      handling: handlingFromOrder(order),
      // Which km rule the editor's live price must use (orders made before
      // FULL_DISTANCE_KM_PRICING_FROM keep the old one).
      useFullDistanceKmPricing: usesFullDistanceKmPricing(order.createdAt),
      comparison: compareOrderWithPayments({ payments: order.payments, current: buildOrderStateSnapshot(order) }),
      catalogProducts: catalog.products,
      categories: seeded.map(({ catalog: list }) => ({
        code: list.priceListCode,
        labelEn: list.labelEn,
        labelNo: list.labelNo,
        productIds: list.products.flatMap((p) => idByCode.get(p.code) ?? []),
      })),
    });
  } catch (err) {
    console.error("[website-items] Failed to load catalog:", err);
    return NextResponse.json({ ok: false, reason: "CATALOG_UNAVAILABLE" }, { status: 500 });
  }
}

const reject = (reason: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, reason, ...extra }, { status });

// Fields whose change is logged on the order's history.
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
] as const;

const LOGGED_HANDLING_FIELDS = [
  ["driver", "Driver"],
  ["secondDriver", "Second driver"],
  ["driverInfo", "Info for the driver"],
  ["licensePlate", "License plate"],
  ["deviation", "Deviation"],
  ["description", "Description"],
  ["rabatt", "Discount"],
  ["leggTil", "Extra"],
  ["subcontractorMinus", "Partner minus"],
  ["subcontractorPlus", "Partner plus"],
  ["deliveryDate", "Delivery date"],
  ["timeWindow", "Time window"],
] as const;

export async function PUT(req: Request, { params }: Params) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;
  const { companyId, membership } = auth;

  const body = (await req.json().catch(() => null)) as {
    productCards?: unknown;
    details?: unknown;
    handling?: unknown;
    // The calculator's "Set to 0" choices (like the booking app's checkboxes).
    nulledLines?: unknown;
    sendPaymentLink?: unknown;
    dryRun?: unknown;
  } | null;
  if (body?.productCards !== undefined && !Array.isArray(body.productCards)) {
    return reject("INVALID_BODY", 400);
  }
  const nulledLines = body?.nulledLines === undefined ? null : parseNulledLines(body.nulledLines);
  if (body?.nulledLines !== undefined && !nulledLines) return reject("INVALID_BODY", 400);
  const sendPaymentLink = body?.sendPaymentLink === true;
  const dryRun = body?.dryRun === true;

  const { orderId } = await params;
  const order = await findWhiteGoodsOrder(orderId, companyId);
  if (!order) return reject("NOT_FOUND", 404);
  const changesProductsOrDetails = body?.productCards !== undefined || body?.details !== undefined;
  if (changesProductsOrDetails && LOCKED_STATUSES.has(normalizeOrderStatus(order.status))) {
    return reject("NOT_EDITABLE_STATUS", 409);
  }

  // The admin's handling fields — express, discount, extra and the deviation
  // change the price, so they're laid over the order before re-pricing.
  let handling: ReturnType<typeof handlingOrderData> | null = null;
  let parsedHandling: WebsiteOrderHandling | null = null;
  let customDeviation: { price: number | null; subcontractorPrice: number | null; description: string | null } | undefined;
  if (body?.handling !== undefined) {
    // Fields left out keep their stored value (the calculator sends only its own).
    const parsed = parseWebsiteOrderHandling(body.handling, handlingFromOrder(order));
    if (!parsed.ok) return reject(parsed.reason, 422, { errors: parsed.errors });
    parsedHandling = parsed.handling;
    handling = handlingOrderData(parsed.handling);
    customDeviation = parsed.handling.customDeviation;
  }

  // An admin can save anything, even an order with no products or one
  // that isn't complete yet — only products not sold on the website are
  // refused (they can't be priced).
  const baseCards = Array.isArray(body?.productCards) ? (body.productCards as SavedProductCard[]) : storedCards(order);
  const cards = nulledLines ? applyNulledLinesToCards(baseCards, nulledLines) : baseCards;
  const catalog = await getWebsiteOrderCatalog();
  if (findUnsellableProductIds(cards, catalog.products).length > 0) return reject("UNKNOWN_PRODUCT", 422);

  // Details: validated, the route distance recalculated when a stop moved
  // (unless the admin typed one), then laid over the order for re-pricing.
  let detailsUpdate: ReturnType<typeof buildDetailsUpdate> | null = null;
  if (body?.details !== undefined) {
    const parsed = parseAdminOrderDetails(body.details);
    if (!parsed.ok) return reject(parsed.reason, 422, { errors: parsed.errors });
    const details = parsed.details;

    // The editor sends the distance it priced with (override); otherwise it
    // is recalculated when a stop moved — and the stored one kept when the
    // route can't be worked out (an empty or unknown address).
    let drivingDistance = order.drivingDistance ?? "";
    const routable = details.pickups.length > 0 && details.pickups.every((stop) => stop.address) && !!details.delivery.address;
    if (details.drivingDistanceOverride !== null) {
      drivingDistance = details.drivingDistanceOverride;
    } else if (routable && routeAddressesChanged(order, details)) {
      try {
        const route = await getRouteDistance({
          pickupAddress: details.pickups[0]?.address,
          extraPickupAddresses: details.pickups.slice(1).map((stop) => stop.address),
          deliveryAddress: details.delivery.address,
        });
        if (route) drivingDistance = route.distanceKm;
      } catch (err) {
        console.error("[website-items] Route distance failed, keeping the stored distance:", err);
      }
    }

    detailsUpdate = buildDetailsUpdate({
      details,
      drivingDistance,
      storedBookingDetails: order.websiteBookingDetails,
      storedDescription: order.description,
    });
  }

  const detailsBookingDetails = detailsUpdate ? detailsUpdate.bookingDetails : order.websiteBookingDetails;
  const pricedOrder = {
    ...order,
    ...(detailsUpdate ? detailsUpdate.orderData : {}),
    // The handling description is the admin's own text — it wins over the
    // regenerated pickup notes when both are saved.
    ...(handling ?? {}),
    // The date and time window are on the order and in the booking details.
    websiteBookingDetails: parsedHandling ? scheduleBookingDetails(detailsBookingDetails, parsedHandling) : detailsBookingDetails,
    ...(customDeviation !== undefined ? { customDeviation } : {}),
    ...(nulledLines ? { nulledOrderExtras: nulledLines.orderExtras } : {}),
  };

  let recomputed;
  try {
    recomputed = await recomputeWebsiteOrderPricing(pricedOrder, cards, { allowIncomplete: true });
  } catch (err) {
    if (err instanceof SizeBracketSelectionError) return reject("SIZE_BRACKETS_REQUIRED", 422);
    if (err instanceof ItemNameRequiredError) return reject("ITEM_NAME_REQUIRED", 422);
    console.error("[website-items] Failed to re-price order:", err);
    return reject("UPDATE_FAILED", 500);
  }

  // The order as it would be after this save, against what was paid.
  const nextBookingDetails = (() => {
    const base = parseWhiteGoodsBookingDetails(pricedOrder.websiteBookingDetails);
    return base ? { ...base, orderExtras: recomputed.orderExtras } : pricedOrder.websiteBookingDetails;
  })();
  const comparison = compareOrderWithPayments({
    payments: order.payments,
    current: buildOrderStateSnapshot({
      ...pricedOrder,
      priceExVat: recomputed.priceExVat,
      pricingSnapshot: recomputed.pricingSnapshot,
      websiteBookingDetails: nextBookingDetails,
    }),
  });

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      previousPriceExVat: order.priceExVat,
      priceExVat: recomputed.priceExVat,
      drivingDistance: pricedOrder.drivingDistance,
      comparison,
      calculator: websiteOrderCalculatorView(recomputed.pricingResult, { includePartner: true }),
    });
  }

  // Decided before anything is saved, so "Save & send" never leaves a saved
  // order without the link the admin asked for (except a failed send).
  const email = pricedOrder.email;
  const plan = sendPaymentLink
    ? planWebsiteOrderPaymentLink({
        status: order.status,
        email,
        remainingBalanceIncVatNok: Math.max(0, comparison.differenceIncVatNok),
      })
    : null;
  if (plan && !plan.ok) return reject(plan.reason, 409);

  const approve = plan?.ok === true && plan.approve;
  const now = new Date();
  // The payment links are built from the action token — minted on approval
  // (same as the bulk approve) when the order doesn't have one yet.
  const actionToken = plan ? (order.actionToken ?? createOrderActionToken()) : order.actionToken;

  try {
    await prisma.$transaction(
      websiteOrderPricingWrites({ id: order.id, websiteBookingDetails: pricedOrder.websiteBookingDetails }, recomputed, {
        lastEditedByMembershipId: membership.id,
        ...(detailsUpdate?.orderData ?? {}),
        ...(handling ?? {}),
        ...(approve ? { status: "approved", approvedAt: now, statusChangedAt: now } : {}),
        ...(actionToken !== order.actionToken ? { actionToken } : {}),
      }),
    );
  } catch (err) {
    console.error("[website-items] Failed to save order:", err);
    return reject("UPDATE_FAILED", 500);
  }

  const actor: OrderEventActor = {
    membershipId: membership.id,
    name: membership.user?.username ?? null,
    email: membership.user?.email ?? null,
    source: "USER",
  };

  if (approve) {
    await resolveAllOrderNotifications(prisma, { orderId: order.id, companyId, resolvedByMembershipId: membership.id });
  }

  const changes: OrderEventChange[] = [
    ...(detailsUpdate
      ? LOGGED_FIELDS.map(([field, label]) => ({
          field,
          label,
          previousValue: order[field] ?? "",
          nextValue: detailsUpdate.orderData[field] ?? "",
        }))
      : []),
    ...(handling
      ? LOGGED_HANDLING_FIELDS.map(([field, label]) => ({
          field,
          label,
          previousValue: order[field] ?? "",
          nextValue: handling[field] ?? "",
        }))
      : []),
    ...(handling
      ? [
          {
            field: "expressDelivery" as const,
            label: "Express delivery",
            previousValue: order.expressDelivery ? "yes" : "no",
            nextValue: handling.expressDelivery ? "yes" : "no",
          },
        ]
      : []),
    {
      field: "extraPickupAddress",
      label: "Extra pickups",
      previousValue: order.extraPickupAddress.join(" | "),
      nextValue: pricedOrder.extraPickupAddress.join(" | "),
    },
    {
      field: "productsSummary",
      label: "Products",
      previousValue: order.productsSummary ?? "",
      nextValue: recomputed.summaries.productsSummary ?? "",
    },
    {
      field: "priceExVat",
      label: "Price (ex VAT)",
      previousValue: String(order.priceExVat),
      nextValue: String(recomputed.priceExVat),
    },
    ...(approve ? [{ field: "status" as const, label: "Status", previousValue: order.status ?? "", nextValue: "approved" }] : []),
  ];
  await createOrderUpdatedEvent(prisma, {
    orderId: order.id,
    companyId,
    actor,
    changes: changes.filter((change) => change.previousValue !== change.nextValue),
  });

  let emailSent: string | null = null;
  let emailFailed = false;
  if (plan?.ok) {
    const balanceDue =
      plan.kind === "balance_due"
        ? {
            paidIncVatNok: comparison.totalPaidIncVatNok,
            totalIncVatNok: comparison.currentTotalIncVatNok,
            amountDueIncVatNok: comparison.differenceIncVatNok,
            changes: [
              ...comparison.lineChanges.map((change) => describeLineChange(change, "no")),
              ...comparison.detailChanges.map((change) => describeDetailChange(change, "no")),
            ],
          }
        : undefined;
    const result = await sendLifecycleEmailsForOrders({
      orders: [{ ...order, ...detailsUpdate?.orderData, companyId, email, actionToken, balanceDue }],
      kind: plan.kind,
      actor,
    });
    if (result.failedOrderIds.length === 0) emailSent = plan.kind;
    else emailFailed = true;
  }

  return NextResponse.json({
    ok: true,
    previousPriceExVat: order.priceExVat,
    priceExVat: recomputed.priceExVat,
    drivingDistance: pricedOrder.drivingDistance,
    comparison,
    emailSent,
    emailFailed,
  });
}
