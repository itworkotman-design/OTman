import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { isManualPaymentMode } from "@/lib/orders/paymentMode";
import { reconcileCheckoutSessions } from "@/lib/stripe/reconcileCheckoutSessions";

// Every 15 minutes (external scheduler, bearer CRON_SECRET): Stripe checkout
// sessions whose webhook never arrived are recorded or expired after all —
// lib/stripe/reconcileCheckoutSessions.ts.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  // Fakturas (lib/invoices/) have no checkout sessions to reconcile.
  if (isManualPaymentMode()) {
    return NextResponse.json({ ok: true, skipped: "PAYMENTS_ARE_MANUAL" });
  }

  const summary = await reconcileCheckoutSessions({ stripe: getStripeClient() });
  return NextResponse.json({ ok: true, ...summary });
}
