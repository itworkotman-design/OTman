import { prisma } from "@/lib/db";
import { getOrderActionBaseUrl, getStripeClient } from "@/lib/stripe/stripeClient";
import { createOrderCheckoutSession } from "@/lib/stripe/orderCheckoutSession";
import { createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";
import { cancelledOrderPartnerData } from "@/lib/orders/cancelledOrderPartner";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { getOrderChargeAmountIncVatNok, type ChargeableOrder } from "@/lib/orders/orderTotals";
import { welcomeWebsiteOrderCustomer } from "@/lib/customerAccounts/welcomeWebsiteOrderCustomer";

// The side effects of paying at booking (see ./bookingPayment.ts): opening the
// Checkout session as the order is placed, cancelling an order whose checkout
// expired unpaid, and welcoming the customer once the payment lands.

const STRIPE_ACTOR = { source: "SYSTEM", name: "Stripe" } as const;

type BookingOrder = ChargeableOrder & {
  id: string;
  companyId: string;
  displayId: number;
  orderNumber: string | null;
  status: string | null;
  email: string | null;
  actionToken: string | null;
  productsSummary: string | null;
  subcontractorMembershipId: string | null;
  subcontractor: string | null;
};

// Never throws. On failure the order is cancelled, so no unpaid order is left
// waiting for a checkout that never opened.
export async function startBookingCheckout(order: BookingOrder): Promise<{ ok: true; url: string } | { ok: false }> {
  try {
    if (!order.email || !order.actionToken) throw new Error("Order has no email or action token");
    const session = await createOrderCheckoutSession(getStripeClient(), {
      order: { ...order, email: order.email },
      token: order.actionToken,
      amountIncVatNok: getOrderChargeAmountIncVatNok(order),
      chargeKind: "booking",
      baseUrl: getOrderActionBaseUrl(),
    });
    if (!session.url) throw new Error("Stripe session has no URL");
    await prisma.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });
    return { ok: true, url: session.url };
  } catch (error) {
    console.error("[booking checkout] Could not start payment", order.id, error);
    try {
      await cancelUnpaidBookingOrder(order, { note: "The payment could not be started." });
    } catch (cancelError) {
      console.error("[booking checkout] Could not cancel the unpaid order", order.id, cancelError);
    }
    return { ok: false };
  }
}

// Cancels the order only if it is still unpaid (and, given a sessionId, still
// on that checkout session), so a payment landing at the same moment wins.
export async function cancelUnpaidBookingOrder(
  order: Pick<BookingOrder, "id" | "companyId" | "displayId" | "status" | "subcontractorMembershipId" | "subcontractor">,
  params: { sessionId?: string; note: string },
): Promise<boolean> {
  const cancelledPartner = await cancelledOrderPartnerData(prisma, {
    companyId: order.companyId,
    displayId: order.displayId,
    previousStatus: order.status,
    nextStatus: "cancelled",
    partner: { subcontractorMembershipId: order.subcontractorMembershipId, subcontractor: order.subcontractor },
  });

  const { count } = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: "processing",
      paymentStatus: "pending",
      ...(params.sessionId ? { stripeCheckoutSessionId: params.sessionId } : {}),
    },
    data: { status: "cancelled", statusNotes: params.note, statusChangedAt: new Date(), ...cancelledPartner },
  });
  if (count === 0) return false;

  await createOrderStatusChangedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: STRIPE_ACTOR,
    fromStatus: order.status,
    toStatus: "cancelled",
    note: params.note,
  });
  return true;
}

// Once the booking payment lands: what placing the order does in manual mode
// (lib/customerAccounts/welcomeWebsiteOrderCustomer.ts — "My order" login +
// order-received email), plus the staff alert.
export async function welcomePaidBookingOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  await createOrderNotification(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    type: "MANUAL_REVIEW",
    title: "WEBSITE ORDER - PAID",
    message: `Order placed and paid via the homepage website order flow. Customer: ${order.customerName ?? "—"}, Phone: ${order.phone ?? "—"}, Email: ${order.email ?? "—"}.`,
  });

  await welcomeWebsiteOrderCustomer(order);
}
