import { ORDER_PAYMENT_LEDGER_SELECT } from "@/lib/orders/orderPayments";
import { isCustomerAccountExpired, LIFETIME_ORDER_SELECT } from "@/lib/customerAccounts/accountLifetime";
import { normalizeCustomerEmail } from "@/lib/customerAccounts/ensureCustomerAccount";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";
import { parseWhiteGoodsBookingDetails, withLiveOrderFields } from "@/lib/orders/websiteBookingDetails";
import {
  groupPricingLinesByCard,
  pricingLinesFromSnapshot,
  checkWebsiteOrderTotals,
} from "@/lib/orders/websiteOrderProducts";
import { getOrderChargeAmountIncVatNok } from "@/lib/orders/orderTotals";
import { handlingFromOrder } from "@/lib/orders/websiteOrderHandling";
import { buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { recomputeWebsiteOrderPricing, resolveSavedCatalogPricing } from "@/lib/orders/websiteOrderRepricing";
import { getWebsiteOrderCatalog } from "@/lib/content/websiteOrderCatalog";
import { websiteOrderCalculatorView } from "@/lib/orders/websiteOrderCalculator";
import { normalizeSavedProductCard, type SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { getSavedOrderPricingSnapshot } from "@/lib/booking/pricing/snapshot";
import { findMissingSnapshotPrices } from "@/lib/orders/websitePriceChanges";
import { diffCalculatorRows, type PriceChangeRow } from "@/lib/booking/pricing/priceChanges";
import { MOVING_ORDER_KIND, parseMovingBookingDetails } from "@/lib/orders/movingBookingDetails";
import { movingEditFromOrder } from "@/lib/orders/movingOrderEdit";
import { movingOrderPriceView } from "@/lib/orders/movingOrderView";
import {
  movingAdjustmentsFromOrder,
  movingOrderAdjustedPricing,
  movingOrderCalculatorView,
  movingPriceChanges,
} from "@/lib/orders/movingOrderCalculator";
import { movingCurrentPriceRows } from "@/lib/orders/movingCurrentPrices";
import { movingHandlingFromOrder } from "@/lib/orders/movingHandlingLines";
import { getMovingCatalog, type MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import { parseServiceBookingDetails, SERVICE_ORDER_KIND } from "@/lib/orders/serviceBookingDetails";
import { serviceEditFromOrder } from "@/lib/orders/serviceOrderEdit";
import { serviceOrderCalculatorView } from "@/lib/orders/serviceOrderCalculator";

// Read-only view of a homepage website order (a white-goods delivery, a move
// or a service request) for the admin
// WebsiteOrderModal. Kept separate from GET /api/orders/[orderId] (which backs
// the regular BookingEditor) so that route stays untouched. Any non-ok answer
// tells DashboardOrderModal to fall back to the regular OrderModal.
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getAuthenticatedSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId: session.activeCompanyId, status: "ACTIVE" },
    select: { role: true, appAccess: true },
  });
  const canView =
    !!membership &&
    (membership.role === "OWNER" ||
      membership.role === "ADMIN" ||
      getModuleAccess(membership, "WEBSITE_ORDERS").enabled);
  if (!canView) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }
  // Partner prices are for admins only, like the booking app's partner view.
  const websiteOrders = getModuleAccess(membership, "WEBSITE_ORDERS");
  const canSeePartnerPrices =
    membership.role === "OWNER" || membership.role === "ADMIN" || (websiteOrders.enabled && websiteOrders.level === "ADMIN");

  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId: session.activeCompanyId },
    select: {
      id: true,
      displayId: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      customerName: true,
      phone: true,
      email: true,
      customerComments: true,
      statusNotes: true,
      priceExVat: true,
      priceSubcontractor: true,
      rabatt: true,
      leggTil: true,
      subcontractorMinus: true,
      subcontractorPlus: true,
      floorNo: true,
      lift: true,
      productCardsSnapshot: true,
      // An older order's saved catalog prices are read back from these.
      items: {
        select: {
          optionId: true,
          customerPriceCents: true,
          subcontractorPriceCents: true,
          // A move's lines are shown straight from these (movingOrderPriceView).
          cardId: true,
          productName: true,
          itemType: true,
          productCode: true,
          optionCode: true,
          optionLabel: true,
          quantity: true,
        },
      },
      driver: true,
      secondDriver: true,
      driverInfo: true,
      licensePlate: true,
      deviation: true,
      description: true,
      expressDelivery: true,
      payments: { select: ORDER_PAYMENT_LEDGER_SELECT },
      websiteOrderKind: true,
      websiteBookingDetails: true,
      pricingSnapshot: true,
      pickupAddress: true,
      deliveryAddress: true,
      extraPickupAddress: true,
      deliveryDate: true,
      timeWindow: true,
      drivingDistance: true,
      subcontractorMembershipId: true,
      subcontractor: true,
      gsmSentAt: true,
      gsmSyncStatus: true,
      customerAccount: { select: { email: true, orders: { select: LIFETIME_ORDER_SELECT } } },
    },
  });
  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  // What every website order shows, whatever it is.
  const base = {
    id: order.id,
    displayId: order.displayId,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customerName,
    phone: order.phone,
    email: order.email,
    customerComments: order.customerComments,
    statusNotes: order.statusNotes,
    priceExVat: order.priceExVat,
    subcontractorMembershipId: order.subcontractorMembershipId,
    subcontractor: order.subcontractor,
    gsmSentAt: order.gsmSentAt ? order.gsmSentAt.toISOString() : null,
    gsmSyncStatus: order.gsmSyncStatus,
    // A live "My order" login for the order's email — then "Send new login"
    // isn't offered (password help is under User management → Website users).
    hasCustomerLogin:
      !!order.customerAccount &&
      order.customerAccount.email === normalizeCustomerEmail(order.email) &&
      !isCustomerAccountExpired(order.customerAccount.orders),
    // The fields only an admin handles (driver, deviation, discount…).
    handling: handlingFromOrder(order),
    // Paid so far vs. the order now: what changed and what's due/refundable.
    payment: compareOrderWithPayments({
      payments: order.payments ?? [],
      current: buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }),
    }),
  };

  // A homepage move: its answers (editable as a whole) and its priced lines,
  // read from the order's stored lines, in the delivery calculator's shape.
  const movingEdit = order.websiteOrderKind === MOVING_ORDER_KIND ? movingEditFromOrder(order) : null;
  if (movingEdit) {
    const customer = movingOrderPriceView(order.items, "customer");
    const adjustments = movingAdjustmentsFromOrder(order);
    // The same calculator a delivery order has (partner side for admins only).
    const calculator = movingOrderCalculatorView(order.items, adjustments, { includePartner: canSeePartnerPrices });
    // The size names for the move's cards, and its answers at today's prices
    // ("Use new price"); the order opens without them.
    let sizeOptions: MovingCatalogOption[] = [];
    let currentPricesTotal: number | null = null;
    let priceChanges: PriceChangeRow[] = [];
    try {
      const catalog = await getMovingCatalog();
      sizeOptions = catalog?.options ?? [];
      const current = catalog ? movingCurrentPriceRows(catalog, order) : null;
      if (current) {
        currentPricesTotal = movingOrderAdjustedPricing(current, adjustments).priceExVat;
        priceChanges = movingPriceChanges(order.items, current, { includePartner: canSeePartnerPrices });
      }
    } catch (err) {
      console.error("[website-details] Couldn't load the moving catalog:", err);
    }
    return NextResponse.json({
      ok: true,
      order: {
        ...base,
        kind: "moving",
        // A custom deviation's own values live on its line (movingHandlingLines).
        handling: movingHandlingFromOrder(order),
        moving: {
          edit: movingEdit,
          customerType: parseMovingBookingDetails(order.websiteBookingDetails)?.customerType ?? null,
          preferredDate: order.deliveryDate ?? "",
          timeWindow: order.timeWindow ?? "",
          drivingDistance: order.drivingDistance ?? "",
        },
        sizeOptions,
        products: customer.products,
        orderExtras: customer.orderExtras,
        // Checked against the calculator's lines, so a line set to 0 counts at 0.
        totalsCheck: checkWebsiteOrderTotals({
          total: order.priceExVat,
          chargedIncVat: getOrderChargeAmountIncVatNok(order),
          products: [],
          orderExtras: calculator.products.flatMap((product) => product.lines.map((line) => ({ price: line.customer }))),
          rabatt: order.rabatt,
          leggTil: order.leggTil,
          shownTotal: null,
        }),
        calculator,
        currentPricesTotal,
        priceChanges,
      },
    });
  }

  // A homepage service request: its answers and staff's quotes (a line per service),
  // with express/deviation, in the same calculator as a move.
  const serviceEdit = order.websiteOrderKind === SERVICE_ORDER_KIND ? serviceEditFromOrder(order) : null;
  if (serviceEdit) {
    const calculator = serviceOrderCalculatorView(order.items, movingAdjustmentsFromOrder(order), { includePartner: canSeePartnerPrices });
    return NextResponse.json({
      ok: true,
      order: {
        ...base,
        kind: "service",
        // A custom deviation's own values live on its line (movingHandlingLines).
        handling: movingHandlingFromOrder(order),
        service: {
          // The partner price only for who may see it.
          edit: canSeePartnerPrices
            ? serviceEdit
            : { ...serviceEdit, services: serviceEdit.services.map((s) => ({ ...s, quote: { ...s.quote, partner: null } })) },
          customerType: parseServiceBookingDetails(order.websiteBookingDetails)?.customerType ?? null,
          preferredDate: order.deliveryDate ?? "",
          timeWindow: order.timeWindow ?? "",
        },
        products: [],
        // Checked against the calculator's lines, so a line set to 0 counts at 0.
        totalsCheck: checkWebsiteOrderTotals({
          total: order.priceExVat,
          chargedIncVat: getOrderChargeAmountIncVatNok(order),
          products: [],
          orderExtras: calculator.products.flatMap((product) => product.lines.map((line) => ({ price: line.customer }))),
          rabatt: order.rabatt,
          leggTil: order.leggTil,
          shownTotal: null,
        }),
        calculator,
      },
    });
  }

  const bookedDetails =
    order.websiteOrderKind === "WHITE_GOODS" ? parseWhiteGoodsBookingDetails(order.websiteBookingDetails) : null;
  if (!bookedDetails) {
    return NextResponse.json({ ok: false, reason: "NOT_WHITE_GOODS_WEBSITE_ORDER" }, { status: 404 });
  }

  // Addresses/date as they are now (an edit updates the columns, not the
  // stored details), and whatever the total holds beyond the booked lines.
  const details = withLiveOrderFields(bookedDetails, {
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    extraPickupAddress: order.extraPickupAddress ?? [],
    deliveryDate: order.deliveryDate,
    timeWindow: order.timeWindow,
    drivingDistance: order.drivingDistance,
  });
  const products = groupPricingLinesByCard(pricingLinesFromSnapshot(order.pricingSnapshot));

  // The calculator: the stored order priced the way it's saved, every line
  // with its customer and partner price. An order that can't be priced still
  // opens, just without it.
  // Priced with the catalog prices saved on its cards (like the booking app);
  // today's total is only offered, for "Use new price". Older orders saved
  // before their cards kept prices: read back from their stored lines
  // (resolveSavedCatalogPricing), else priced with today's catalog.
  let calculator = null;
  let currentPricesTotal: number | null = null;
  // What "Use new price" would change, line by line.
  let priceChanges: PriceChangeRow[] = [];
  const cards = Array.isArray(order.productCardsSnapshot) ? (order.productCardsSnapshot as unknown as SavedProductCard[]) : [];
  try {
    // Loaded once: every pricing below (up to 4 for an older order) uses it.
    const catalog = await getWebsiteOrderCatalog();
    const catalogPricing = await resolveSavedCatalogPricing(order, cards, order.items ?? [], { catalog });
    const priced = await recomputeWebsiteOrderPricing(order, cards, { allowIncomplete: true, catalogPricing, catalog });
    calculator = websiteOrderCalculatorView(priced.pricingResult, {
      includePartner: canSeePartnerPrices,
      cards: priced.cards,
      products: priced.catalogProducts,
    });
    const current = catalogPricing ? await recomputeWebsiteOrderPricing(order, cards, { allowIncomplete: true, catalog }) : priced;
    currentPricesTotal = websiteOrderCalculatorView(current.pricingResult, { includePartner: false }).customer.total;
    if (current !== priced) {
      const rows = diffCalculatorRows(priced.pricingResult, current.pricingResult);
      // Partner prices only for who may see them.
      priceChanges = canSeePartnerPrices
        ? rows
        : rows.filter((row) => row.saved !== row.now).map((row) => ({ ...row, savedPartner: null, nowPartner: null }));
    }
  } catch (err) {
    console.error("[website-details] Couldn't price the order for the calculator:", err);
  }
  // Products whose saved prices lack their delivery type or an option — the
  // order may be stored without that charge.
  const savedSnapshot = getSavedOrderPricingSnapshot(cards);
  const storedLines = pricingLinesFromSnapshot(order.pricingSnapshot);
  const savedPricesIncomplete = savedSnapshot
    ? findMissingSnapshotPrices(
        cards.map((card, i) => normalizeSavedProductCard(card, i)),
        savedSnapshot,
      ).map((cardId) => storedLines.find((line) => line.cardId === cardId)?.productName ?? `#${cardId + 1}`)
    : [];

  return NextResponse.json({
    ok: true,
    order: {
      ...base,
      details,
      products,
      // Lines vs total vs what the customer was shown — any mismatch is a
      // warning in the modal (the customer pays what they were shown).
      totalsCheck: checkWebsiteOrderTotals({
        // Lines and total ex. VAT (as stored); the shown total against what's charged.
        total: order.priceExVat,
        chargedIncVat: getOrderChargeAmountIncVatNok(order),
        products,
        orderExtras: details.orderExtras,
        rabatt: order.rabatt,
        leggTil: order.leggTil,
        shownTotal: details.shownTotal,
      }),
      calculator,
      // The customer total at today's catalog prices ("Use new price" when it differs).
      currentPricesTotal,
      priceChanges,
      savedPricesIncomplete,
    },
  });
}
