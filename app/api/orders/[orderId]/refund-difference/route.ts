import { NextResponse } from "next/server";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { refundOrderDifference } from "@/lib/orders/refundOrderDifference";

// "Refund difference" on a website order: its price went down after the
// customer paid, so they've overpaid — refunds exactly that (see
// lib/orders/refundOrderDifference.ts). The client sends the amount it showed
// (`amountCents`); if the order changed since, the refund is refused with the
// current amount instead of refunding something staff didn't see.

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  const body = await req.json().catch(() => null);
  const result = await refundOrderDifference({
    orderId,
    companyId: auth.companyId,
    actor: auth.actor,
    // A missing amount never matches, so a refund always needs one.
    expectedAmountCents: typeof body?.amountCents === "number" ? body.amountCents : -1,
  });

  if (!result.ok) {
    const { status, ...json } = result;
    return NextResponse.json(json, { status });
  }
  return NextResponse.json({ ok: true, refundedCents: result.refundedCents, ...(result.emailFailed ? { emailFailed: true } : {}) });
}
