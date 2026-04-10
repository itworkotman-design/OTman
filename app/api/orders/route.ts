import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canCreateOrders } from "@/lib/users/orderAccess";
import {
  optionalBoolean,
  optionalString,
  safeNumber,
} from "@/lib/orders/normalizeOrderInput";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { sendOrderNotificationEmail } from "@/lib/orders/orderNotificationEmail";
import {
  normalizeSavedProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { AppPermission } from "@/lib/users/types";

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

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
      id: true,
      role: true,
      priceListId: true,
      user: {
        select: {
          username: true,
          email: true,
        },
      },
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

  if (!canCreateOrders(membership.role, permissions)) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

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

  const productCards = (body.productCards as SavedProductCard[]).map(
    (card, index) => normalizeSavedProductCard(card, index),
  );

  const isAdminOrOwner =
    membership.role === "OWNER" || membership.role === "ADMIN";

  const customerMembershipId =
    optionalString(body.customerMembershipId) || membership.id;

  const customerLabel =
    optionalString(body.customerLabel) ||
    membership.user.username ||
    membership.user.email;

  const customerName = optionalString(body.customerName);

  // Important:
  // For admin-created orders, use the selected customer's pricelist if possible.
  let effectivePriceListId = membership.priceListId ?? null;

  if (isAdminOrOwner && customerMembershipId) {
    const selectedCustomerMembership = await prisma.membership.findFirst({
      where: {
        id: customerMembershipId,
        companyId: session.activeCompanyId,
        status: "ACTIVE",
      },
      select: {
        priceListId: true,
      },
    });

    effectivePriceListId =
      selectedCustomerMembership?.priceListId ?? membership.priceListId ?? null;
  }

  const catalog = await getBookingCatalog(effectivePriceListId);

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

  const nextDisplayId = await reserveNextOrderNumber(session.activeCompanyId);

  const order = await prisma.order.create({
    data: {
      companyId: session.activeCompanyId,
      createdByMembershipId: membership.id,
      lastEditedByMembershipId: null,
      priceListId: effectivePriceListId,

      customerMembershipId,
      customerLabel,
      customerName,

      displayId: nextDisplayId,
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
      returnAddress: optionalString(body.returnAddress),
      drivingDistance: optionalString(body.drivingDistance),

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
      status: optionalString(body.status) || "behandles",
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

  if (builtItems.length > 0) {
    await prisma.orderItem.createMany({
      data: builtItems.map((item) => ({
        orderId: order.id,
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
      })),
    });
  }

  const pending = await prisma.pendingOrderAttachment.findMany({
    where: { sessionId: session.userId },
  });

  for (const a of pending) {
    await prisma.orderAttachment.create({
      data: {
        orderId: order.id,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        storagePath: a.storagePath,
      },
    });
  }

  await prisma.pendingOrderAttachment.deleteMany({
    where: { sessionId: session.userId },
  });

  try {
    await sendOrderNotificationEmail({
      kind: "created",
      order: {
        id: order.id,
        displayId: order.displayId,
        orderNumber: order.orderNumber,
        customerLabel,
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
        customerName,
        email: optionalString(body.email),
        phone: optionalString(body.phone),
        floorNo: optionalString(body.floorNo),
        lift: optionalString(body.lift),
        cashierName: optionalString(body.cashierName),
        cashierPhone: optionalString(body.cashierPhone),
        status: optionalString(body.status) || "behandles",
        createdAt: order.createdAt,
        productsSummary: summaries.productsSummary,
        priceExVat: Math.round(safeNumber(body.priceExVat)),
      },
      items: builtItems,
    });
  } catch (error) {
    console.error("Failed to send order creation notification email", error);
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    displayId: order.displayId,
  });
}

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

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
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

  const { searchParams } = new URL(req.url);

  const status = optionalString(searchParams.get("status"));
  const customerMembershipId = optionalString(
    searchParams.get("customerMembershipId"),
  );
  const subcontractorId = optionalString(searchParams.get("subcontractorId"));
  const createdById = optionalString(searchParams.get("createdById"));
  const fromDate = optionalString(searchParams.get("fromDate"));
  const toDate = optionalString(searchParams.get("toDate"));
  const search = optionalString(searchParams.get("search"));
  const sortBy = optionalString(searchParams.get("sortBy"));
  const sortOrder =
    optionalString(searchParams.get("sortOrder")) === "asc" ? "asc" : "desc";

  const page = parsePositiveInt(searchParams.get("page"), 1);
  const rowsPerPage = Math.min(
    500,
    parsePositiveInt(searchParams.get("rowsPerPage"), 25),
  );

  const isAdminOrOwner =
    membership.role === "OWNER" || membership.role === "ADMIN";
  const isOrderCreator =
    !isAdminOrOwner && canCreateOrders(membership.role, permissions);

  const where: Prisma.OrderWhereInput = {
    companyId: session.activeCompanyId,
  };

  if (isAdminOrOwner) {
    if (subcontractorId) {
      where.subcontractorMembershipId = subcontractorId;
    }

    if (createdById) {
      where.createdByMembershipId = createdById;
    }
  } else if (isOrderCreator) {
    where.customerMembershipId = membership.id;
  } else {
    where.subcontractorMembershipId = membership.id;
  }

  if (status) {
    where.status = status;
  }

  if (isAdminOrOwner && customerMembershipId) {
    where.customerMembershipId = customerMembershipId;
  }

  if (fromDate || toDate) {
    where.deliveryDate = {};

    if (fromDate) {
      where.deliveryDate.gte = fromDate;
    }

    if (toDate) {
      where.deliveryDate.lte = toDate;
    }
  }

  if (search) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { id: { contains: search, mode: "insensitive" } },
          ...(Number.isFinite(Number(search))
            ? [{ displayId: Number(search) }]
            : []),
          { orderNumber: { contains: search, mode: "insensitive" } },
          { customerLabel: { contains: search, mode: "insensitive" } },
          { customerName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { pickupAddress: { contains: search, mode: "insensitive" } },
          { deliveryAddress: { contains: search, mode: "insensitive" } },
          { productsSummary: { contains: search, mode: "insensitive" } },
          { subcontractor: { contains: search, mode: "insensitive" } },
          { driver: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          {
            createdByMembership: {
              user: {
                OR: [
                  { username: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
    ];
  }

  const orderBy:
    | Prisma.OrderOrderByWithRelationInput
    | Prisma.OrderOrderByWithRelationInput[] = (() => {
    if (!sortBy) {
      return [
        {
          deliveryDate: {
            sort: "desc",
            nulls: "first",
          },
        },
        {
          createdAt: "desc",
        },
      ];
    }

    switch (sortBy) {
      case "deliveryDate":
        return { deliveryDate: sortOrder };
      case "price":
        return { priceExVat: sortOrder };
      case "status":
        return { status: sortOrder };
      default:
        return { createdAt: "desc" };
    }
  })();

  const orders = await prisma.order.findMany({
    where,
    orderBy,
    skip: (page - 1) * rowsPerPage,
    take: rowsPerPage,
    select: {
      id: true,
      displayId: true,
      status: true,
      statusNotes: true,
      deliveryDate: true,
      timeWindow: true,
      customerLabel: true,
      customerName: true,
      orderNumber: true,
      phone: true,
      pickupAddress: true,
      extraPickupAddress: true,
      deliveryAddress: true,
      returnAddress: true,
      productsSummary: true,
      deliveryTypeSummary: true,
      servicesSummary: true,
      description: true,
      cashierName: true,
      cashierPhone: true,
      customerComments: true,
      driverInfo: true,
      subcontractorMembershipId: true,
      subcontractor: true,
      driver: true,
      createdAt: true,
      updatedAt: true,
      priceExVat: true,
      priceSubcontractor: true,
      createdByMembershipId: true,
      lastEditedByMembershipId: true,
      customerMembershipId: true,
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

  return NextResponse.json({
    ok: true,
    orders: orders.map((order) => ({
      id: order.id,
      displayId: order.displayId ?? 0,
      status: order.status ?? "",
      statusNotes: order.statusNotes ?? "",
      deliveryDate: order.deliveryDate ?? "",
      timeWindow: order.timeWindow ?? "",
      customer: order.customerLabel ?? "",
      customerLabel: order.customerLabel ?? "",
      customerName: order.customerName ?? "",
      orderNumber: order.orderNumber ?? "",
      phone: order.phone ?? "",
      pickupAddress: order.pickupAddress ?? "",
      extraPickupAddress: order.extraPickupAddress ?? [],
      deliveryAddress: order.deliveryAddress ?? "",
      returnAddress: order.returnAddress ?? "",
      productsSummary: order.productsSummary ?? "",
      deliveryTypeSummary: order.deliveryTypeSummary ?? "",
      servicesSummary: order.servicesSummary ?? "",
      description: order.description ?? "",
      cashierName: order.cashierName ?? "",
      cashierPhone: order.cashierPhone ?? "",
      customerComments: order.customerComments ?? "",
      driverInfo: order.driverInfo ?? "",
      subcontractorMembershipId: order.subcontractorMembershipId ?? "",
      subcontractor: order.subcontractor ?? "",
      driver: order.driver ?? "",
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      priceExVat: order.priceExVat,
      priceSubcontractor: order.priceSubcontractor,
      createdByMembershipId: order.createdByMembershipId,
      lastEditedByMembershipId: order.lastEditedByMembershipId ?? "",
      customerMembershipId: order.customerMembershipId ?? "",
      createdBy:
        order.createdByMembership.user.username ||
        order.createdByMembership.user.email ||
        "",
      lastEditedBy:
        order.lastEditedByMembership?.user.username ||
        order.lastEditedByMembership?.user.email ||
        "",
    } )),
    page,
    rowsPerPage,
  });
}
