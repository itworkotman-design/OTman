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

// Read-only view of a homepage white-goods website order for the admin
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
      items: { select: { optionId: true, customerPriceCents: true, subcontractorPriceCents: true } },
      driver: true,
      secondDriver: true,
      driverInfo: true,
      licensePlate: true,
      deviation: true,
      description: true,
      expressDelivery: true,
      payments: { select: { amountChargedCents: true, createdAt: true, orderSnapshot: true } },
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
      calculator,
      // The customer total at today's catalog prices ("Use new price" when it differs).
      currentPricesTotal,
      priceChanges,
      savedPricesIncomplete,
      // The fields only an admin handles (driver, deviation, discount…).
      handling: handlingFromOrder(order),
      // Paid so far vs. the order now: what changed and what's due/refundable.
      payment: compareOrderWithPayments({
        payments: order.payments ?? [],
        current: buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }),
      }),
    },
  });
}
