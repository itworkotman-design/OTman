import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

// What happens to a customer's own "My order" change once the order has been
// paid (netPaidCents > 0 — charges minus refunds):
//
// - dearer: paid FIRST. Nothing is saved; the customer pays the new total
//   minus what's paid (any older balance included), and the change is
//   applied when Stripe confirms (customerOrderPaidChange.ts) — mode "paid".
//   Same before and within 24h (adding a service with the driver there).
// - cheaper: only before the cutoff (within 24h only additions). It's saved,
//   and a confirmed order goes back to processing for staff to review; the
//   overpaid difference is refunded when they set it to confirmed again.
// - an unpaid order just saves: it's paid in full later.

export type PaidOrderChangeDecision =
  | { action: "save"; reopen: boolean }
  | { action: "payFirst"; amountDueCents: number }
  | { action: "reject"; reason: "WOULD_DECREASE_PRICE" };

export function decidePaidOrderChange(input: {
  netPaidCents: number;
  previousPriceExVat: number;
  priceExVat: number;
  // The order's new total incl. VAT — what the customer pays in all.
  totalIncVat: number;
  beforeCutoff: boolean;
  status: string | null;
  // "customer": a change the customer just asked for. "paid": a change they
  // have already paid for, being applied.
  mode: "customer" | "paid";
}): PaidOrderChangeDecision {
  if (input.netPaidCents <= 0) return { action: "save", reopen: false };

  if (input.priceExVat > input.previousPriceExVat) {
    if (input.mode === "paid") return { action: "save", reopen: false };
    const amountDueCents = Math.round(input.totalIncVat * 100) - input.netPaidCents;
    return amountDueCents > 0 ? { action: "payFirst", amountDueCents } : { action: "save", reopen: false };
  }

  if (input.priceExVat < input.previousPriceExVat) {
    if (!input.beforeCutoff) return { action: "reject", reason: "WOULD_DECREASE_PRICE" };
    return { action: "save", reopen: normalizeOrderStatus(input.status) === "confirmed" };
  }

  return { action: "save", reopen: false };
}
