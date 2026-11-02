// How homepage orders are paid. "manual" (the default until Stripe is
// connected): staff send fakturas and mark them paid (lib/invoices/), and the
// Stripe flow (payment links, checkout, Stripe refunds, the payment-timeout
// sweep) is switched off. "stripe": the original Stripe flow. Set with
// HOMEPAGE_PAYMENT_MODE.
export type HomepagePaymentMode = "manual" | "stripe";

export function homepagePaymentMode(env: Record<string, string | undefined> = process.env): HomepagePaymentMode {
  return env.HOMEPAGE_PAYMENT_MODE?.trim().toLowerCase() === "stripe" ? "stripe" : "manual";
}

export function isManualPaymentMode(env?: Record<string, string | undefined>): boolean {
  return homepagePaymentMode(env) === "manual";
}
