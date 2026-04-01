import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

async function reserveNextOrderNumber(companyId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.companyOrderCounter.findUnique({
      where: { companyId },
    });

    if (!existing) {
      await tx.companyOrderCounter.create({
        data: {
          companyId,
          nextNumber: 20001,
        },
      });

      return 20000;
    }

    const reserved = existing.nextNumber;

    await tx.companyOrderCounter.update({
      where: { companyId },
      data: {
        nextNumber: existing.nextNumber + 1,
      },
    });

    return reserved;
  });
}

export async function POST(req: Request) {
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

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const isAdminOrOwner =
    membership.role === "OWNER" || membership.role === "ADMIN";

  if (!isAdminOrOwner) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);

  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter(
        (value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  if (orderIds.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_ORDER_IDS" },
      { status: 400 },
    );
  }

  const sourceOrders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      companyId: session.activeCompanyId,
    },
    include: {
      items: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (sourceOrders.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "ORDERS_NOT_FOUND" },
      { status: 404 },
    );
  }

  const duplicatedOrderIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const sourceOrder of sourceOrders) {
      const reservedDisplayId = await reserveNextOrderNumber(
        session.activeCompanyId!,
      );

      const newOrder = await tx.order.create({
        data: {
          companyId: sourceOrder.companyId,
          createdByMembershipId: sourceOrder.createdByMembershipId,
          lastEditedByMembershipId: null,
          customerMembershipId: sourceOrder.customerMembershipId,
          priceListId: sourceOrder.priceListId,

          displayId: reservedDisplayId,
          orderNumber: sourceOrder.orderNumber,

          customerLabel: sourceOrder.customerLabel,
          customerName: sourceOrder.customerName,

          description: sourceOrder.description,
          modelNr: sourceOrder.modelNr,

          deliveryDate: sourceOrder.deliveryDate,
          timeWindow: sourceOrder.timeWindow,

          pickupAddress: sourceOrder.pickupAddress,
          extraPickupAddress: sourceOrder.extraPickupAddress,
          deliveryAddress: sourceOrder.deliveryAddress,
          returnAddress: sourceOrder.returnAddress,
          drivingDistance: sourceOrder.drivingDistance,

          phone: sourceOrder.phone,
          phoneTwo: sourceOrder.phoneTwo,
          email: sourceOrder.email,
          customerComments: sourceOrder.customerComments,

          floorNo: sourceOrder.floorNo,
          lift: sourceOrder.lift,

          cashierName: sourceOrder.cashierName,
          cashierPhone: sourceOrder.cashierPhone,

          subcontractorMembershipId: sourceOrder.subcontractorMembershipId,
          subcontractor: sourceOrder.subcontractor,

          driver: sourceOrder.driver,
          secondDriver: sourceOrder.secondDriver,
          driverInfo: sourceOrder.driverInfo,
          licensePlate: sourceOrder.licensePlate,

          deviation: sourceOrder.deviation,
          feeExtraWork: sourceOrder.feeExtraWork,
          feeAddToOrder: sourceOrder.feeAddToOrder,
          statusNotes: null,
          status: "behandles",
          dontSendEmail: sourceOrder.dontSendEmail,

          priceExVat: sourceOrder.priceExVat,
          priceSubcontractor: sourceOrder.priceSubcontractor,

          rabatt: sourceOrder.rabatt,
          leggTil: sourceOrder.leggTil,
          subcontractorMinus: sourceOrder.subcontractorMinus,
          subcontractorPlus: sourceOrder.subcontractorPlus,

          productsSummary: sourceOrder.productsSummary,
          deliveryTypeSummary: sourceOrder.deliveryTypeSummary,
          servicesSummary: sourceOrder.servicesSummary,

          productCardsSnapshot:
            sourceOrder.productCardsSnapshot as Prisma.InputJsonValue,
        },
      });

      duplicatedOrderIds.push(newOrder.id);

      if (sourceOrder.items.length > 0) {
        await tx.orderItem.createMany({
          data: sourceOrder.items.map((item) => ({
            orderId: newOrder.id,
            cardId: item.cardId,
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            deliveryType: item.deliveryType,
            itemType: item.itemType,
            optionId: item.optionId,
            optionCode: item.optionCode,
            optionLabel: item.optionLabel,
            quantity: item.quantity,
            customerPriceCents: item.customerPriceCents,
            subcontractorPriceCents: item.subcontractorPriceCents,
            rawData: item.rawData as
              | Prisma.InputJsonValue
              | Prisma.NullTypes.JsonNull,
          })),
        });
      }
    }
  });

  return NextResponse.json({
    ok: true,
    duplicatedCount: duplicatedOrderIds.length,
    orderIds: duplicatedOrderIds,
  });
}
