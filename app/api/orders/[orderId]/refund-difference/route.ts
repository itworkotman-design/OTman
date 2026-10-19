import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { refundOrderPayments } from "@/lib/orders/orderRefunds";
import { ORDER_PAYMENT_LEDGER_SELECT } from "@/lib/orders/orderPayments";
import { ORDER_STATE_SOURCE_SELECT, buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { describeDetailChange, describeLineChange, formatKr } from "@/lib/orders/orderChangeText";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";

// "Refund difference" on a website order: its price went down after the
// customer paid (a discount after a problem on the day, something removed),
// so they've overpaid. Refunds exactly that through Stripe and records the
// order as it is now as the new paid state, so the payment summary is settled
// and later changes compare against it. The status is left alone — an active
// order stays active.
//
// The client sends the amount it showed (`amountCents`); if the order changed
// since, the refund is refused with the current amount instead of refunding
// something staff didn't see.

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId: auth.companyId },
    select: {
      ...ORDER_STATE_SOURCE_SELECT,
      id: true,
      companyId: true,
      displayId: true,
      orderNumber: true,
      status: true,
      isWebsiteOrder: true,
      customerName: true,
      customerLabel: true,
      statusNotes: true,
      actionToken: true,
      email: true,
      emailThreadToken: true,
      payments: { select: ORDER_PAYMENT_LEDGER_SELECT },
    },
  });
  if (!order || !order.isWebsiteOrder) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const current = buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] });
  const comparison = compareOrderWithPayments({ payments: order.payments, current });
  if (comparison.outcome !== "refund") {
    return NextResponse.json({ ok: false, reason: "NOTHING_TO_REFUND" }, { status: 409 });
  }

  const amountCents = Math.round(-comparison.differenceIncVatNok * 100);
  const body = await req.json().catch(() => null);
  if (body?.amountCents !== amountCents) {
    return NextResponse.json({ ok: false, reason: "AMOUNT_CHANGED", amountCents }, { status: 409 });
  }

  const refund = await refundOrderPayments(prisma, getStripeClient(), {
    orderId: order.id,
    companyId: order.companyId,
    amountCents,
    reason: "Price lowered after payment",
    orderSnapshot: current,
  });
  if (!refund.ok) {
    if (refund.reason === "STRIPE_ERROR") {
      // Whatever went through is in the ledger; the summary shows what's left.
      return NextResponse.json({ ok: false, reason: "REFUND_FAILED", refundedCents: refund.refundedCents }, { status: 502 });
    }
    return NextResponse.json({ ok: false, reason: "REFUND_NOT_POSSIBLE" }, { status: 409 });
  }

  const changes = [
    ...comparison.lineChanges.map((change) => describeLineChange(change, "no")),
    ...comparison.detailChanges.map((change) => describeDetailChange(change, "no")),
  ];
  const refundedIncVatNok = refund.refundedCents / 100;

  await createOrderActionEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: auth.actor,
    title: `Refunded ${formatKr(refundedIncVatNok)} to the customer via Stripe`,
    details: changes,
  });

  // Best-effort: the money has gone back whether or not the email does.
  let emailFailed = false;
  if (order.email) {
    try {
      const sent = await sendLifecycleEmailsForOrders({
        orders: [
          {
            ...order,
            refundIssued: { refundedIncVatNok, totalIncVatNok: comparison.currentTotalIncVatNok, changes },
          },
        ],
        kind: "refund_issued",
        actor: auth.actor,
      });
      emailFailed = sent.failedOrderIds.length > 0;
    } catch (error) {
      console.error("[refund-difference] Failed to send the refund email", order.id, error);
      emailFailed = true;
    }
  }

  return NextResponse.json({ ok: true, refundedCents: refund.refundedCents, ...(emailFailed ? { emailFailed } : {}) });
}
