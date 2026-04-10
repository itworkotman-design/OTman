import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canEditOrders } from "@/lib/users/orderAccess";
import {
  optionalBoolean,
  optionalString,
  safeNumber,
} from "@/lib/orders/normalizeOrderInput";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { sendOrderNotificationEmail } from "@/lib/orders/orderNotificationEmail";
import {
  normalizeSavedProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { AppPermission } from "@/lib/users/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
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

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
    },
    select: {
      id: true,
      displayId: true,
      priceListId: true,
      customerMembershipId: true,
      productCardsSnapshot: true,
      orderNumber: true,
      description: true,
      modelNr: true,
      deliveryDate: true,
      timeWindow: true,
      pickupAddress: true,
      extraPickupAddress: true,
      deliveryAddress: true,
      drivingDistance: true,
      customerName: true,
      customerLabel: true,
      phone: true,
      phoneTwo: true,
      email: true,
      customerComments: true,
      floorNo: true,
      lift: true,
      cashierName: true,
      cashierPhone: true,
      subcontractorMembershipId: true,
      subcontractor: true,
      driver: true,
      secondDriver: true,
      driverInfo: true,
      licensePlate: true,
      deviation: true,
      feeExtraWork: true,
      feeAddToOrder: true,
      statusNotes: true,
      status: true,
      dontSendEmail: true,
      priceExVat: true,
      priceSubcontractor: true,
      rabatt: true,
      leggTil: true,
      subcontractorMinus: true,
      subcontractorPlus: true,
      lastEditedByMembershipId: true,
      createdByMembership: {
        select: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      },
      lastEditedByMembership: {
        select: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      displayId: order.displayId ?? 0,
      priceListId: order.priceListId ?? "",
      customerMembershipId: order.customerMembershipId ?? "",
      productCards: Array.isArray(order.productCardsSnapshot)
        ? order.productCardsSnapshot.map((card, index) =>
            normalizeSavedProductCard(
              card as Partial<SavedProductCard>,
              index,
            ),
          )
        : [],
      orderNumber: order.orderNumber ?? "",
      description: order.description ?? "",
      modelNr: order.modelNr ?? "",
      deliveryDate: order.deliveryDate ?? "",
      timeWindow: order.timeWindow ?? "",
      pickupAddress: order.pickupAddress ?? "",
      extraPickupAddress: order.extraPickupAddress ?? [],
      deliveryAddress: order.deliveryAddress ?? "",
      drivingDistance: order.drivingDistance ?? "",
      customerName: order.customerName ?? "",
      customerLabel: order.customerLabel ?? "",
      customer: order.customerLabel ?? "",
      phone: order.phone ?? "",
      phoneTwo: order.phoneTwo ?? "",
      email: order.email ?? "",
      customerComments: order.customerComments ?? "",
      floorNo: order.floorNo ?? "",
      lift: order.lift ?? "",
      cashierName: order.cashierName ?? "",
      cashierPhone: order.cashierPhone ?? "",
      subcontractorMembershipId: order.subcontractorMembershipId ?? "",
      subcontractor: order.subcontractor ?? "",
      driver: order.driver ?? "",
      secondDriver: order.secondDriver ?? "",
      driverInfo: order.driverInfo ?? "",
      licensePlate: order.licensePlate ?? "",
      deviation: order.deviation ?? "",
      feeExtraWork: order.feeExtraWork,
      feeAddToOrder: order.feeAddToOrder,
      statusNotes: order.statusNotes ?? "",
      status: order.status ?? "",
      dontSendEmail: order.dontSendEmail,
      priceExVat: order.priceExVat,
      priceSubcontractor: order.priceSubcontractor,
      rabatt: order.rabatt ?? "",
      leggTil: order.leggTil ?? "",
      subcontractorMinus: order.subcontractorMinus ?? "",
      subcontractorPlus: order.subcontractorPlus ?? "",
      createdBy:
        order.createdByMembership?.user.username ||
        order.createdByMembership?.user.email ||
        "",
      lastEditedBy:
        order.lastEditedByMembership?.user.username ||
        order.lastEditedByMembership?.user.email ||
        "",
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
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
      id: true,
      role: true,
      priceListId: true,
      permissions: {
        select: {
          permission: true,
        },
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const permissions = membership.permissions.map(
    (p): AppPermission => p.permission,
  );

  if (!canEditOrders(membership.role, permissions)) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const { orderId } = await params;
  const body = await req.json().catch(() => null);

  if (
    !body ||
    !Array.isArray(body.productCards) ||
    body.productCards.length === 0
  ) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_PRODUCT_CARDS" },
      { status: 400 },
    );
  }

  const existingOrder = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
    },
    select: {
      id: true,
      displayId: true,
      orderNumber: true,
      priceListId: true,
      customerMembershipId: true,
      customerLabel: true,
      createdAt: true,
    },
  });

  if (!existingOrder) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const productCards = (body.productCards as SavedProductCard[]).map(
    (card, index) => normalizeSavedProductCard(card, index),
  );

  const catalog = await getBookingCatalog(
    existingOrder.priceListId ?? membership.priceListId ?? null,
  );

  const summaries = buildOrderSummaries(
    productCards,
    catalog.products,
    catalog.specialOptions,
  );

  const builtItems = buildOrderItemsFromCards(
    productCards,
    catalog.products,
    catalog.specialOptions,
  );

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        orderNumber: optionalString(body.orderNumber),
        description: optionalString(body.description),
        modelNr: optionalString(body.modelNr),

        deliveryDate: optionalString(body.deliveryDate),
        timeWindow: optionalString(body.timeWindow),

        pickupAddress: optionalString(body.pickupAddress),
        extraPickupAddress: Array.isArray(body.extraPickupAddress)
          ? body.extraPickupAddress
              .filter(
                (value: unknown): value is string => typeof value === "string",
              )
              .map((value: string) => value.trim())
              .filter(Boolean)
          : [],
        deliveryAddress: optionalString(body.deliveryAddress),
        drivingDistance: optionalString(body.drivingDistance),

        customerMembershipId:
          optionalString(body.customerMembershipId) ||
          existingOrder.customerMembershipId,

        lastEditedByMembershipId: membership.id,

        customerLabel:
          optionalString(body.customerLabel) || existingOrder.customerLabel,
        customerName: optionalString(body.customerName),
        phone: optionalString(body.phone),
        phoneTwo: optionalString(body.phoneTwo),
        email: optionalString(body.email),

        customerComments: optionalString(body.customerComments),

        floorNo: optionalString(body.floorNo),
        lift: optionalString(body.lift),

        cashierName: optionalString(body.cashierName),
        cashierPhone: optionalString(body.cashierPhone),

        subcontractorMembershipId: optionalString(body.subcontractorId),
        subcontractor: optionalString(body.subcontractor),

        driver: optionalString(body.driver),
        secondDriver: optionalString(body.secondDriver),
        driverInfo: optionalString(body.driverInfo),
        licensePlate: optionalString(body.licensePlate),

        deviation: optionalString(body.deviation),
        feeExtraWork: optionalBoolean(body.feeExtraWork),
        feeAddToOrder: optionalBoolean(body.feeAddToOrder),
        statusNotes: optionalString(body.statusNotes),
        status: optionalString(body.status),
        dontSendEmail: optionalBoolean(body.dontSendEmail),

        priceExVat: Math.round(safeNumber(body.priceExVat)),
        priceSubcontractor: Math.round(safeNumber(body.priceSubcontractor)),

        rabatt: optionalString(body.rabatt),
        leggTil: optionalString(body.leggTil),
        subcontractorMinus: optionalString(body.subcontractorMinus),
        subcontractorPlus: optionalString(body.subcontractorPlus),

        productsSummary: summaries.productsSummary,
        deliveryTypeSummary: summaries.deliveryTypeSummary,
        servicesSummary: summaries.servicesSummary,

        productCardsSnapshot: productCards as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.orderItem.deleteMany({
      where: {
        orderId,
      },
    });

    for (const item of builtItems) {
      await tx.orderItem.create({
        data: {
          orderId,
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
          rawData: item.rawData
            ? (item.rawData as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
    }
  });

  try {
    await sendOrderNotificationEmail({
      kind: "updated",
      order: {
        id: orderId,
        displayId: existingOrder.displayId,
        orderNumber:
          optionalString(body.orderNumber) || existingOrder.orderNumber,
        customerLabel:
          optionalString(body.customerLabel) || existingOrder.customerLabel,
        deliveryDate: optionalString(body.deliveryDate),
        pickupAddress: optionalString(body.pickupAddress),
        extraPickupAddress: Array.isArray(body.extraPickupAddress)
          ? body.extraPickupAddress
              .filter(
                (value: unknown): value is string => typeof value === "string",
              )
              .map((value: string) => value.trim())
              .filter(Boolean)
          : [],
        deliveryAddress: optionalString(body.deliveryAddress),
        drivingDistance: optionalString(body.drivingDistance),
        timeWindow: optionalString(body.timeWindow),
        description: optionalString(body.description),
        customerName: optionalString(body.customerName),
        email: optionalString(body.email),
        phone: optionalString(body.phone),
        floorNo: optionalString(body.floorNo),
        lift: optionalString(body.lift),
        cashierName: optionalString(body.cashierName),
        cashierPhone: optionalString(body.cashierPhone),
        status: optionalString(body.status),
        createdAt: existingOrder.createdAt,
        productsSummary: summaries.productsSummary,
        priceExVat: Math.round(safeNumber(body.priceExVat)),
      },
      items: builtItems,
    });
  } catch (error) {
    console.error("Failed to send order update notification email", error);
  }

  return NextResponse.json({
    ok: true,
    orderId,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
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

  const { orderId } = await params;

  const result = await prisma.order.deleteMany({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
    },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { ok: false, reason: "ORDER_NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
