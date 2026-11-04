import { compareOrderWithPayments, type OrderStateSnapshot, type PaymentForComparison } from "./paidOrderSnapshot";
import { formatKr } from "./orderChangeText";
import { nextStripePaymentStatus } from "./stripePaymentOverview";

// A pre-launch / periodic check that every place agrees on what a homepage
// customer pays (scripts/check-website-prices.ts runs it over a database):
// - the order's lines (the Stripe description, the pay page, emails) add up
//   to the total that is charged;
// - the booking payment equals the total the customer was shown when booking
//   (websiteBookingDetails.shownTotal);
// - the payment badge (Order.paymentStatus) matches what's been paid (Stripe).

export type PricingIssue = {
  code: "LINES_DONT_ADD_UP" | "CHARGED_DIFFERS_FROM_SHOWN" | "PAYMENT_STATUS_STALE";
  detail: string;
};

export type PricingCheckInput = {
  current: OrderStateSnapshot;
  shownTotalIncVat: number | null;
  payments: PaymentForComparison[];
  paymentStatus: string | null;
  closed: boolean;
  stripe: boolean;
};

// Per-line VAT rounding may leave a few øre.
const TOLERANCE_NOK = 1;

export function checkWebsiteOrderPricing(input: PricingCheckInput): PricingIssue[] {
  const issues: PricingIssue[] = [];

  const linesTotal = input.current.lines.reduce((sum, line) => sum + line.price, 0);
  if (input.current.lines.length > 0 && Math.abs(linesTotal - input.current.totalIncVatNok) >= TOLERANCE_NOK) {
    issues.push({ code: "LINES_DONT_ADD_UP", detail: `lines ${formatKr(linesTotal)} vs total ${formatKr(input.current.totalIncVatNok)}` });
  }

  const booking = [...input.payments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  if (booking && input.shownTotalIncVat !== null) {
    const charged = booking.amountChargedCents / 100;
    if (Math.abs(charged - input.shownTotalIncVat) >= TOLERANCE_NOK) {
      issues.push({
        code: "CHARGED_DIFFERS_FROM_SHOWN",
        detail: `shown ${formatKr(input.shownTotalIncVat)}, charged ${formatKr(charged)} at booking`,
      });
    }
  }

  if (input.stripe && input.payments.length > 0 && !input.closed) {
    const expected = nextStripePaymentStatus(
      compareOrderWithPayments({ payments: input.payments, current: input.current, closed: input.closed }).outcome,
    );
    if (expected && expected !== input.paymentStatus) {
      issues.push({ code: "PAYMENT_STATUS_STALE", detail: `badge ${input.paymentStatus ?? "none"}, should be ${expected}` });
    }
  }

  return issues;
}
