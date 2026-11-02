import { NextResponse } from "next/server";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { markOrderInvoicesPaid } from "@/lib/invoices/orderInvoices";

// "Mark as paid" on a homepage order: every unpaid faktura is now paid. The
// only way an order's payment status becomes "paid" (lib/invoices/orderInvoices.ts).

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;
  const { orderId } = await params;

  const result = await markOrderInvoicesPaid({ orderId, companyId: auth.companyId, actor: auth.actor });
  if (!result.ok) return NextResponse.json(result, { status: result.reason === "ORDER_NOT_FOUND" ? 404 : 409 });
  return NextResponse.json(result);
}
