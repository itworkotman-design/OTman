import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOrderActionBaseUrl, getStripeClient } from "@/lib/stripe/stripeClient";
import { CUSTOMER_ORDER_SELECT, type CustomerOrder } from "@/lib/customerAccounts/customerOrderView";
import { editCustomerOrder } from "@/lib/customerAccounts/customerOrderEdit";
import { recordOrderPayment } from "@/lib/orders/orderPayments";
import { refundOrderPayments } from "@/lib/orders/orderRefunds";
import { ORDER_STATE_SOURCE_SELECT, buildOrderStateSnapshot } from "@/lib/orders/paidOrderSnapshot";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";
import { formatKr } from "@/lib/orders/orderChangeText";

// A "My order" change that makes a PAID order dearer is paid for first
// (lib/customerAccounts/paidOrderChange.ts):
//
// 1. startPaidChangeCheckout — the PUT holds the change (OrderPendingChange,
//    the body as sent) and opens a Stripe checkout for the difference. The
//    order itself is untouched.
// 2. applyPaidChange — the Stripe webhook, once paid: the change is run again
//    through the same "My order" edit (mode "paid", at the price it was paid
//    for), then the payment is recorded against the changed order. The
//    status is never touched — an active order stays active.
//
// If the change can't be applied any more (the 24h deadline passed while
// paying, the price moved, …) the payment is refunded automatically and staff
// are alerted to call the customer.

const ACTOR = { source: "SYSTEM", name: "Stripe" } as const;
// Stripe's minimum: keeps the price the customer saw fresh.
const CHECKOUT_LIFETIME_SECONDS = 30 * 60;

export async function startPaidChangeCheckout(input: {
  order: Pick<CustomerOrder, "id" | "companyId" | "displayId" | "orderNumber" | "email" | "productsSummary">;
  accountId: string;
  body: unknown;
  amountDueCents: number;
  totalIncVat: number;
}): Promise<{ url: string }> {
  const { order } = input;
  // Stored as it'll be applied: never a preview, at the price shown.
  const body = Object.fromEntries(Object.entries((input.body ?? {}) as Record<string, unknown>).filter(([key]) => key !== "dryRun"));

  const pending = await prisma.orderPendingChange.create({
    data: {
      orderId: order.id,
      companyId: order.companyId,
      customerAccountId: input.accountId,
      body: body as Prisma.InputJsonValue,
      amountDueCents: input.amountDueCents,
      expectedTotalIncVat: input.totalIncVat,
    },
    select: { id: true },
  });

  const baseUrl = getOrderActionBaseUrl();
  const reference = order.orderNumber?.trim() || String(order.displayId);
  const orderUrl = `${baseUrl}/min-bestilling/${encodeURIComponent(order.orderNumber ?? "")}`;
  const session = await getStripeClient().checkout.sessions.create({
    mode: "payment",
    customer_email: order.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "nok",
          unit_amount: input.amountDueCents,
          product_data: { name: `Otman bestilling #${reference} — endring`, description: order.productsSummary ?? undefined },
        },
      },
    ],
    success_url: `${orderUrl}?endring=betalt`,
    cancel_url: `${orderUrl}?endring=avbrutt`,
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME_SECONDS,
    metadata: { orderId: order.id, pendingChangeId: pending.id, chargeKind: "change" },
  });

  await prisma.orderPendingChange.update({ where: { id: pending.id }, data: { stripeCheckoutSessionId: session.id } });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return { url: session.url };
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
}

async function loadOrder(orderId: string) {
  return prisma.order.findFirst({ where: { id: orderId }, select: { ...CUSTOMER_ORDER_SELECT, ...ORDER_STATE_SOURCE_SELECT } });
}

async function recordPayment(session: Stripe.Checkout.Session, order: NonNullable<Awaited<ReturnType<typeof loadOrder>>>) {
  // Idempotent on the Stripe session (orderPayments.ts).
  return recordOrderPayment(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId(session),
    amountChargedCents: session.amount_total ?? 0,
    orderSnapshot: buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }),
  });
}

export async function applyPaidChange(session: Stripe.Checkout.Session): Promise<void> {
  const pendingChangeId = session.metadata?.pendingChangeId;
  if (!pendingChangeId) return;
  const pending = await prisma.orderPendingChange.findUnique({ where: { id: pendingChangeId } });
  if (!pending) return;

  // Claimed once: a redelivered event finds it taken.
  const claimed = await prisma.orderPendingChange.updateMany({ where: { id: pending.id, status: "PENDING" }, data: { status: "APPLYING" } });
  const order = await loadOrder(pending.orderId);

  if (claimed.count === 0) {
    if (order) await recordPayment(session, order);
    return;
  }

  if (!order) {
    console.error("[paid change] Order gone before its paid change could be applied — refund by hand", pending.id, session.id);
    await prisma.orderPendingChange.update({
      where: { id: pending.id },
      data: { status: "FAILED", failureReason: "ORDER_NOT_FOUND", resolvedAt: new Date() },
    });
    return;
  }

  const result = await editCustomerOrder(
    order,
    { ...(pending.body as Record<string, unknown>), shownTotal: pending.expectedTotalIncVat },
    { now: new Date(), mode: "paid" },
  );
  // Paid for something that turned out to change nothing counts as not applied (refunded).
  const applied = result.status === 200 && result.json.ok === true && result.json.changed === true;

  // Recorded after the change, so what this payment covered is the order as
  // changed (the payment summary is then settled).
  const changed = applied ? await loadOrder(order.id) : order;
  await recordPayment(session, changed ?? order);

  const paidIncVat = (session.amount_total ?? 0) / 100;
  if (applied) {
    await prisma.orderPendingChange.update({ where: { id: pending.id }, data: { status: "APPLIED", resolvedAt: new Date() } });
    await createOrderActionEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor: ACTOR,
      title: `Customer paid ${formatKr(paidIncVat)} for their change via Stripe`,
      details: [],
    });
    return;
  }

  const reason = typeof result.json.reason === "string" ? result.json.reason : result.status === 200 ? "NO_CHANGE" : `HTTP_${result.status}`;
  const refund = await refundOrderPayments(prisma, getStripeClient(), {
    orderId: order.id,
    companyId: order.companyId,
    amountCents: session.amount_total ?? 0,
    reason: `Paid change could not be applied: ${reason}`,
  });
  await prisma.orderPendingChange.update({
    where: { id: pending.id },
    data: { status: "FAILED", failureReason: reason, resolvedAt: new Date() },
  });
  await createOrderNotification(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    type: "MANUAL_REVIEW",
    title: `Paid change couldn't be applied — order #${order.orderNumber ?? order.displayId}`,
    message: [
      `The customer paid ${formatKr(paidIncVat)} for a change in "My order", but it couldn't be applied any more (${reason}).`,
      refund.ok
        ? "The payment was refunded automatically."
        : "The automatic refund FAILED — refund it in Stripe.",
      "Contact the customer.",
    ].join("\n"),
  });
}
