import { NextResponse } from "next/server";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

export async function GET(request: Request) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        companyId: authentication.companyId,
        gdprHold: true,
      },
      select: {
        displayId: true,
        status: true,
        deliveryDate: true,
        gdprHoldReason: true,
        gdprHoldSetAt: true,
      },
      orderBy: { gdprHoldSetAt: "asc" },
    });

    return NextResponse.json({
      orders: orders.map((order) => ({
        orderNumber: order.displayId,
        status: normalizeOrderStatus(order.status),
        deliveryDate: order.deliveryDate,
        gdprHoldReason: order.gdprHoldReason,
        gdprHoldSetAt: order.gdprHoldSetAt,
      })),
    });
  } catch (error) {
    console.error("MCP held-orders lookup failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
