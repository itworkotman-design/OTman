import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { refundOrderPayments } from "@/lib/orders/orderRefunds";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { createOrderStatusChangedEvent } from "@/lib/orders/orderEvents";
import { resolveAllOrderNotifications } from "@/lib/orders/orderNotifications";
import { sendLifecycleEmailsForOrders } from "@/lib/orders/sendCustomerLifecycleEmail";
import { findCancelledOrderPartner } from "@/lib/orders/cancelledOrderPartner";
import { isPartnerTrackedOrder } from "@/lib/orders/partnerRequirement";

// "Decline" on a website order: a job we can't or won't do (outside our area,
// an item we don't handle, ...). Unlike "needs change" (status rejected), the
// order is closed for good: everything paid is refunded through Stripe first,
// and only once the money has gone back does the order become "refunded" —
// or plain "cancelled" when nothing had been paid (a service still waiting
// for its payment link). This is the only way an order becomes "refunded",
// so that status always means the refund really happened.

type Params = { params: Promise<{ orderId: string }> };

const NOT_DECLINABLE = new Set(["completed", "cancelled", "refunded"]);

// Company owner/admin, or anyone with Website orders at ADMIN level — the
// same rule as the admin website-order editor.
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

export async function POST(req: Request, { params }: Params) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId: auth.companyId },
    select: {
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
      subcontractorMembershipId: true,
      subcontractor: true,
    },
  });
  if (!order || !order.isWebsiteOrder) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ ok: false, reason: "REASON_REQUIRED" }, { status: 400 });
  }

  if (NOT_DECLINABLE.has(normalizeOrderStatus(order.status))) {
    return NextResponse.json({ ok: false, reason: "NOT_DECLINABLE" }, { status: 409 });
  }

  const refund = await refundOrderPayments(prisma, getStripeClient(), {
    orderId: order.id,
    companyId: order.companyId,
    amountCents: "ALL",
    reason,
  });

  let refundedCents = 0;
  if (refund.ok) {
    refundedCents = refund.refundedCents;
  } else if (refund.reason === "STRIPE_ERROR") {
    // Whatever went through is in the ledger; declining again refunds the rest.
    return NextResponse.json({ ok: false, reason: "REFUND_FAILED", refundedCents: refund.refundedCents }, { status: 502 });
  } else if (refund.reason !== "NOTHING_TO_REFUND") {
    return NextResponse.json({ ok: false, reason: "REFUND_NOT_POSSIBLE" }, { status: 409 });
  }

  const nextStatus = refundedCents > 0 ? "refunded" : "cancelled";

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: nextStatus,
      statusNotes: reason,
      statusChangedAt: new Date(),
      lastEditedByMembershipId: auth.membership.id,
    },
  });

  // Same as any cancelled order: a partner-tracked order that never got a
  // partner gets the placeholder, so the missing-partner sweep leaves it be.
  const cancelledPartner = isPartnerTrackedOrder(order.displayId)
    ? await findCancelledOrderPartner(prisma, order.companyId)
    : null;
  if (cancelledPartner) {
    await prisma.order.updateMany({
      where: {
        id: order.id,
        subcontractorMembershipId: null,
        OR: [{ subcontractor: null }, { subcontractor: "" }],
      },
      data: cancelledPartner,
    });
  }

  const actor = {
    membershipId: auth.membership.id,
    name: auth.membership.user.username ?? null,
    email: auth.membership.user.email,
    source: "USER",
  } as const;

  await createOrderStatusChangedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor,
    fromStatus: order.status,
    toStatus: nextStatus,
    note: reason,
  });
  await resolveAllOrderNotifications(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    resolvedByMembershipId: auth.membership.id,
  });

  // Best-effort: the refund has already happened and must not be reported
  // as a failure just because the email didn't go out.
  let emailFailed = false;
  if (order.email) {
    try {
      const sent = await sendLifecycleEmailsForOrders({
        orders: [{ ...order, statusNotes: reason, refundedIncVatNok: refundedCents / 100 }],
        kind: "order_declined",
        actor,
      });
      emailFailed = sent.failedOrderIds.length > 0;
    } catch (error) {
      console.error("[decline] Failed to send the order-declined email", order.id, error);
      emailFailed = true;
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus, refundedCents, ...(emailFailed ? { emailFailed } : {}) });
}
