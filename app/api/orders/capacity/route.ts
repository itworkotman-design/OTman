import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import {
  ORDER_SLOT_LIMIT,
  countOrdersInDeliverySlot,
  isDeliverySlotOverCapacity,
} from "@/lib/orders/capacity";
import { optionalString } from "@/lib/orders/normalizeOrderInput";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const { searchParams } = new URL(req.url);

  const deliveryDate = optionalString(searchParams.get("deliveryDate"));
  const timeWindow = optionalString(searchParams.get("timeWindow"));
  const excludeOrderId = optionalString(searchParams.get("excludeOrderId"));

  if (!deliveryDate || !timeWindow) {
    return NextResponse.json({
      ok: true,
      count: 0,
      limit: ORDER_SLOT_LIMIT,
      isOverCapacity: false,
      message: "",
    });
  }

    const count = await countOrdersInDeliverySlot(prisma, {
      companyId: session.activeCompanyId,
      deliveryDate,
      timeWindow,
      ...(excludeOrderId ? { excludeOrderId } : {}),
    });

  const totalCount = excludeOrderId ? count + 1 : count;
  const isOverCapacity = isDeliverySlotOverCapacity(
    totalCount,
    ORDER_SLOT_LIMIT,
  );

  return NextResponse.json({
    ok: true,
    count: totalCount,
    limit: ORDER_SLOT_LIMIT,
    isOverCapacity,
    message: isOverCapacity
      ? "This time window is full. Order time might get changed."
      : "",
  });
}
