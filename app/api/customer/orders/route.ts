import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerAccounts/customerSession";
import { listCustomerOrders } from "@/lib/customerAccounts/customerOrderView";

// The logged-in customer's orders (one account can have several).
export async function GET(req: Request) {
  const session = await getCustomerSession(req);
  if (!session) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ ok: true, email: session.email, orders: await listCustomerOrders(session.accountId) });
}
