import { NextResponse } from "next/server";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { isManualPaymentMode } from "@/lib/orders/paymentMode";
import { requestOrderBalancePayment } from "@/lib/orders/requestOrderBalancePayment";

// "Send payment request" on a website order: its price went up after the
// customer paid by Stripe, so they owe the difference — emails them a link to
// pay exactly that (lib/orders/requestOrderBalancePayment.ts). The client
// sends the amount it showed (`amountCents`); if the order changed since, it's
// refused with the current amount instead of asking for something unseen.

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;

  // With manual payments the difference is collected by faktura (lib/invoices/).
  if (isManualPaymentMode()) {
    return NextResponse.json({ ok: false, reason: "PAYMENTS_ARE_MANUAL" }, { status: 409 });
  }

  const { orderId } = await params;
  const body = await req.json().catch(() => null);
  const result = await requestOrderBalancePayment({
    orderId,
    companyId: auth.companyId,
    actor: auth.actor,
    // A missing amount never matches, so a request always needs one.
    expectedAmountCents: typeof body?.amountCents === "number" ? body.amountCents : -1,
  });

  if (!result.ok) {
    const { status, ...json } = result;
    return NextResponse.json(json, { status });
  }
  return NextResponse.json({ ok: true, amountCents: result.amountCents });
}
