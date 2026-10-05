import { normalizeOrderStatus } from "./statusPresentation";

// "Save & send payment link" in the admin WebsiteOrderModal: which existing
// customer email that maps to for the order's current status. A not-yet-
// approved order is approved first (same as the website-orders "Approve +
// send email" action) and gets the payment request; a paid order that now
// owes more gets the balance-due email for the difference. The pay page
// always charges the current total/balance, so a re-sent link is never stale.

export type WebsiteOrderPaymentLinkPlan =
  | { ok: true; kind: "payment_request" | "balance_due"; approve: boolean }
  | { ok: false; reason: "MISSING_CUSTOMER_EMAIL" | "NOTHING_TO_PAY" | "NOT_PAYABLE_STATUS" };

const BEFORE_APPROVAL = new Set(["", "processing", "rejected"]);
const AWAITING_PAYMENT = new Set(["approved", "failed"]);

export function planWebsiteOrderPaymentLink(order: {
  status: string | null;
  email: string | null;
  // After the save — see getOrderRemainingBalanceIncVatNok.
  remainingBalanceIncVatNok: number;
}): WebsiteOrderPaymentLinkPlan {
  if (!order.email?.trim()) return { ok: false, reason: "MISSING_CUSTOMER_EMAIL" };

  const status = normalizeOrderStatus(order.status);
  if (BEFORE_APPROVAL.has(status)) return { ok: true, kind: "payment_request", approve: true };
  if (AWAITING_PAYMENT.has(status)) return { ok: true, kind: "payment_request", approve: false };
  if (status === "confirmed") {
    return order.remainingBalanceIncVatNok > 0
      ? { ok: true, kind: "balance_due", approve: false }
      : { ok: false, reason: "NOTHING_TO_PAY" };
  }
  return { ok: false, reason: "NOT_PAYABLE_STATUS" };
}
