import { NextResponse } from "next/server";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { homepagePaymentMode } from "@/lib/orders/paymentMode";
import { getOrderStripePaymentOverview } from "@/lib/orders/stripePaymentOverview";

// The Alert Center's Payment tab: how this homepage order is paid. With
// Stripe, every payment and refund and paid so far vs. the order now
// (lib/orders/stripePaymentOverview.ts). With manual payments only the mode —
// the tab then shows the fakturas (../invoices).

type Params = { params: Promise<{ orderId: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;

  const paymentMode = homepagePaymentMode();
  if (paymentMode === "manual") return NextResponse.json({ ok: true, paymentMode });

  const { orderId } = await params;
  const overview = await getOrderStripePaymentOverview(orderId, auth.companyId);
  if (!overview) return NextResponse.json({ ok: false, reason: "ORDER_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true, paymentMode, ...overview });
}
