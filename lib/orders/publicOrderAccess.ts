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
      rabatt: true,
      leggTil: true,
      pricingSnapshot: true,
      actionToken: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
    },
  });
}

export function isOrderPayable(status: string | null | undefined): boolean {
  return PAYABLE_STATUSES.has(normalizeOrderStatus(status));
}
