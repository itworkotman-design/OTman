import { prisma } from "@/lib/db";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

const TOKEN_FORMAT = /^[a-f0-9]{32}$/i;

export function isValidActionTokenFormat(token: string | null | undefined): token is string {
  return typeof token === "string" && TOKEN_FORMAT.test(token);
}

// Statuses from which the customer can still complete payment — the initial
// approval, and the state the 3-day timeout sweep leaves the order in.
const PAYABLE_STATUSES = new Set(["approved", "failed"]);

export async function getOrderByActionToken(token: string | null | undefined) {
  if (!isValidActionTokenFormat(token)) {
    return null;
  }

  return prisma.order.findUnique({
    where: { actionToken: token },
    select: {
      id: true,
      companyId: true,
      displayId: true,
      orderNumber: true,
      status: true,
      customerName: true,
      customerLabel: true,
      email: true,
      deliveryDate: true,
      timeWindow: true,
      pickupAddress: true,
      deliveryAddress: true,
      productsSummary: true,
      priceExVat: true,
      priceSubcontractor: true,
      rabatt: true,
      leggTil: true,
      subcontractorMinus: true,
      subcontractorPlus: true,
      pricingSnapshot: true,
      productCardsSnapshot: true,
      priceListId: true,
      // Order-level pricing context — needed to re-run the exact same
      // pricing pipeline the order was originally priced with (see
      // app/api/public/orders/[token]/edit-items/route.ts), so a "Forgot
      // something?" edit changes only what the customer actually touched
      // (delivery type/addons per product), not e.g. re-deriving express
      // delivery from whatever "now" happens to be at edit time.
      drivingDistance: true,
      expressDelivery: true,
      floorNo: true,
      lift: true,
      websiteBookingDetails: true,
      // Homepage catalog orders are charged their VAT-inclusive client total
      // (see getOrderChargeAmountIncVatNok).
      websiteOrderKind: true,
      // An admin-set deviation fee, kept when the customer re-prices.
      deviation: true,
      extraPickupAddress: true,
      actionToken: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
      payments: { select: { amountChargedCents: true, createdAt: true, orderSnapshot: true } },
    },
  });
}

export function isOrderPayable(status: string | null | undefined): boolean {
  return PAYABLE_STATUSES.has(normalizeOrderStatus(status));
}

// A confirmed (already paid at least once) order can still owe more once
// staff add items to it after the fact — see
// docs/homepage-ordering-roadmap.md §4. `remainingBalanceIncVatNok` is the
// caller's own getOrderRemainingBalanceIncVatNok(order, totalPaidCents)
// result (lib/orders/orderTotals.ts) — kept as a parameter here rather than
// computed internally so this function stays a plain status/number check.
export function isTopUpPayable(
  status: string | null | undefined,
  remainingBalanceIncVatNok: number,
): boolean {
  return normalizeOrderStatus(status) === "confirmed" && remainingBalanceIncVatNok > 0;
}
