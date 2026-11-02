import { NextResponse } from "next/server";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { getOrderInvoiceOverview, sendOrderInvoice } from "@/lib/invoices/orderInvoices";

// A homepage order's manual fakturas (lib/invoices/orderInvoices.ts).
// GET: every faktura/kreditnota and how the order stands (the Payment tab and
// card). POST { kind: "invoice" | "refund", amountCents }: send a faktura for
// what's owed beyond what's been invoiced, or record a kreditnota for what was
// overpaid. amountCents is what the admin's button showed; if the order has
// changed since, nothing is sent and the current amount comes back (409).

type Params = { params: Promise<{ orderId: string }> };

const STATUS_BY_REASON: Record<string, number> = {
  ORDER_NOT_FOUND: 404,
  NOTHING_TO_INVOICE: 409,
  NOTHING_TO_REFUND: 409,
  AMOUNT_CHANGED: 409,
  INVOICE_IN_PROGRESS: 409,
  MISSING_CUSTOMER_EMAIL: 422,
  INVOICE_SETTINGS_MISSING: 500,
  INVOICE_SEND_FAILED: 502,
};

export async function GET(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;
  const { orderId } = await params;
  const overview = await getOrderInvoiceOverview(orderId, auth.companyId);
  if (!overview) return NextResponse.json({ ok: false, reason: "ORDER_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true, ...overview });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;
  const { orderId } = await params;
  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  if ((kind !== "invoice" && kind !== "refund") || typeof body?.amountCents !== "number") {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const result = await sendOrderInvoice({
    orderId,
    companyId: auth.companyId,
    actor: auth.actor,
    kind,
    expectedAmountCents: body.amountCents,
  });
  if (!result.ok) return NextResponse.json(result, { status: STATUS_BY_REASON[result.reason] ?? 400 });
  return NextResponse.json(result);
}
