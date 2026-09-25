import { NextResponse } from "next/server";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

const INVOICED_WARNING_AFTER_MONTHS = 2;

function monthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

export async function GET(request: Request) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  try {
    const candidates = await prisma.order.findMany({
      where: {
        companyId: authentication.companyId,
        invoicedAt: { not: null, lte: monthsAgo(INVOICED_WARNING_AFTER_MONTHS) },
      },
      select: {
        displayId: true,
        deliveryDate: true,
        status: true,
        invoicedAt: true,
        gdprHold: true,
      },
      orderBy: { invoicedAt: "asc" },
    });

    const orders = candidates
      .filter((order) => normalizeOrderStatus(order.status) === "invoiced")
      .map((order) => ({
        orderNumber: order.displayId,
        deliveryDate: order.deliveryDate,
        status: normalizeOrderStatus(order.status),
        invoicedAt: order.invoicedAt,
        gdprHold: order.gdprHold,
      }));

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("MCP invoiced-warning lookup failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
