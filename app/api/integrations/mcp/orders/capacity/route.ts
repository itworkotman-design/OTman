import { NextResponse } from "next/server";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import {
  ORDER_SLOT_HARD_LIMIT,
  ORDER_SLOT_LIMIT,
  countOrdersInDeliverySlot,
  isDeliverySlotOverCapacity,
} from "@/lib/orders/capacity";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const deliveryDate = searchParams.get("deliveryDate")?.trim();
  const timeWindow = searchParams.get("timeWindow")?.trim();

  if (!deliveryDate || !timeWindow) {
    return NextResponse.json(
      { ok: false, reason: "MISSING_PARAMETERS" },
      { status: 400 },
    );
  }

  try {
    const count = await countOrdersInDeliverySlot(prisma, {
      companyId: authentication.companyId,
      deliveryDate,
      timeWindow,
    });

    return NextResponse.json({
      capacity: {
        deliveryDate,
        timeWindow,
        count,
        limit: ORDER_SLOT_LIMIT,
        hardLimit: ORDER_SLOT_HARD_LIMIT,
        isOverCapacity: isDeliverySlotOverCapacity(count, ORDER_SLOT_LIMIT),
        isHardLimitReached: count >= ORDER_SLOT_HARD_LIMIT,
      },
    });
  } catch (error) {
    console.error("MCP capacity lookup failed", {
      deliveryDate,
      timeWindow,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
