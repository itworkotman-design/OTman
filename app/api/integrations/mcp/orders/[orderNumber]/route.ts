import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

const mcpOrderSelect = Prisma.validator<Prisma.OrderSelect>()({
  displayId: true,
  orderNumber: true,
  status: true,
  deliveryDate: true,
  timeWindow: true,
  expressDelivery: true,
  customerName: true,
  customerLabel: true,
  pickupAddress: true,
  extraPickupAddress: true,
  deliveryAddress: true,
  returnAddress: true,
  productsSummary: true,
  deliveryTypeSummary: true,
  servicesSummary: true,
  description: true,
  createdAt: true,
  updatedAt: true,
});

type RouteContext = { params: Promise<{ orderNumber: string }> };

function parseOrderNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const orderNumber = Number(value);
  return Number.isSafeInteger(orderNumber) && orderNumber > 0
    ? orderNumber
    : null;
}

export async function GET(request: Request, context: RouteContext) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  const { orderNumber: rawOrderNumber } = await context.params;
  const orderNumber = parseOrderNumber(rawOrderNumber);

  if (orderNumber === null) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_ORDER_NUMBER" },
      { status: 400 },
    );
  }

  try {
    const order = await prisma.order.findUnique({
      where: {
        companyId_displayId: {
          companyId: authentication.companyId,
          displayId: orderNumber,
        },
      },
      select: mcpOrderSelect,
    });

    if (!order) {
      return NextResponse.json(
        { ok: false, reason: "ORDER_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      order: {
        orderNumber: order.displayId,
        customerReference: order.orderNumber,
        status: normalizeOrderStatus(order.status) || null,
        schedule: {
          deliveryDate: order.deliveryDate,
          timeWindow: order.timeWindow,
          expressDelivery: order.expressDelivery,
        },
        customer: {
          name: order.customerName,
          label: order.customerLabel,
        },
        addresses: {
          pickup: order.pickupAddress,
          additionalPickups: order.extraPickupAddress,
          delivery: order.deliveryAddress,
          return: order.returnAddress,
        },
        summary: {
          products: order.productsSummary,
          deliveryType: order.deliveryTypeSummary,
          services: order.servicesSummary,
          description: order.description,
        },
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("MCP exact order lookup failed", {
      orderNumber,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
