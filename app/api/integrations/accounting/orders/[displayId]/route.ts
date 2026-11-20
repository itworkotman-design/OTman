import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authenticateAccountingRequest } from "@/lib/integrations/accounting/authenticateAccountingRequest";
import { accountingOrderSelect, toAccountingOrder } from "@/lib/integrations/accounting/accountingOrder";

type RouteContext = { params: Promise<{ displayId: string }> };

function parseDisplayId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const displayId = Number(value);
  return Number.isSafeInteger(displayId) && displayId > 0 ? displayId : null;
}

/**
 * One order by its booking number, for linking it to an insurance case in the
 * accounting app: the accounting row plus the customer's name and the store's
 * own order reference. Nothing else about the customer (no phone, email or address).
 */
export async function GET(request: Request, context: RouteContext) {
  const authentication = authenticateAccountingRequest(request);

  if (!authentication.ok) {
    return NextResponse.json({ ok: false, reason: authentication.reason }, { status: authentication.status });
  }

  const displayId = parseDisplayId((await context.params).displayId);
  if (displayId === null) {
    return NextResponse.json({ ok: false, reason: "INVALID_BOOKING_NUMBER" }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { companyId_displayId: { companyId: authentication.companyId, displayId } },
      select: { ...accountingOrderSelect, customerName: true, orderNumber: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, reason: "ORDER_NOT_FOUND" }, { status: 404 });
    }

    const priceList = order.priceListId
      ? await prisma.priceList.findUnique({ where: { id: order.priceListId }, select: { name: true } })
      : null;
    const priceListNames = new Map(order.priceListId && priceList ? [[order.priceListId, priceList.name]] : []);

    return NextResponse.json({
      ok: true,
      order: {
        ...toAccountingOrder(order, { priceListNames }),
        customerName: order.customerName?.trim() || null,
        storeReference: order.orderNumber?.trim() || null,
      },
    });
  } catch (error) {
    console.error("Accounting order lookup failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ ok: false, reason: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
