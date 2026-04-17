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
import {
  getOptionalEmailError,
  getOptionalPhoneError,
  normalizeOptionalEmail,
  normalizeOptionalPhone,
} from "@/lib/orders/contactValidation";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { sendOrderNotificationEmail } from "@/lib/orders/orderNotificationEmail";
import {
  buildOrderEventSnapshot,
  createOrderCreatedEvent,
} from "@/lib/orders/orderEvents";
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
  const emailError = getOptionalEmailError(body.email);
  const phoneError = getOptionalPhoneError(body.phone);
  const phoneTwoError = getOptionalPhoneError(body.phoneTwo);
  const cashierPhoneError = getOptionalPhoneError(body.cashierPhone);

  if (emailError) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_EMAIL", message: emailError },
      { status: 400 },
    );
  }

  if (phoneError) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_PHONE", message: phoneError },
      { status: 400 },
    );
  }

  if (phoneTwoError) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_PHONE_TWO", message: phoneTwoError },
      { status: 400 },
    );
  }

  if (cashierPhoneError) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_CASHIER_PHONE", message: cashierPhoneError },
      { status: 400 },
    );
  }

  const email = normalizeOptionalEmail(body.email);
  const phone = normalizeOptionalPhone(body.phone);
  const phoneTwo = normalizeOptionalPhone(body.phoneTwo);
  const cashierPhone = normalizeOptionalPhone(body.cashierPhone);

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
      expressDelivery: optionalBoolean(body.expressDelivery),
      contactCustomerForCustomTimeWindow: optionalBoolean(
        body.contactCustomerForCustomTimeWindow,
      ),
      customTimeContactNote: optionalString(body.customTimeContactNote),

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

      phone,
      phoneTwo,
      email,
      customerComments: optionalString(body.customerComments),

      floorNo: optionalString(body.floorNo),
      lift: optionalString(body.lift),

      cashierName: optionalString(body.cashierName),
      cashierPhone,

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
        category: a.category,
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

  await createOrderCreatedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: {
      membershipId: membership.id,
      name: membership.user.username ?? null,
      email: membership.user.email,
      source: "USER",
    },
    snapshot: buildOrderEventSnapshot({
      displayId: order.displayId,
      orderNumber: order.orderNumber,
      status: order.status,
      statusNotes: order.statusNotes,
      customerLabel: order.customerLabel,
      customerName: order.customerName,
      deliveryDate: order.deliveryDate,
      timeWindow: order.timeWindow,
      expressDelivery: order.expressDelivery,
      contactCustomerForCustomTimeWindow:
        order.contactCustomerForCustomTimeWindow,
      customTimeContactNote: order.customTimeContactNote,
      pickupAddress: order.pickupAddress,
      extraPickupAddress: order.extraPickupAddress,
      deliveryAddress: order.deliveryAddress,
      returnAddress: order.returnAddress,
      drivingDistance: order.drivingDistance,
      phone: order.phone,
      phoneTwo: order.phoneTwo,
      email: order.email,
      customerComments: order.customerComments,
      description: order.description,
      productsSummary: order.productsSummary,
      deliveryTypeSummary: order.deliveryTypeSummary,
      servicesSummary: order.servicesSummary,
      cashierName: order.cashierName,
      cashierPhone: order.cashierPhone,
      subcontractor: order.subcontractor,
      driver: order.driver,
      secondDriver: order.secondDriver,
      driverInfo: order.driverInfo,
      licensePlate: order.licensePlate,
      deviation: order.deviation,
      feeExtraWork: order.feeExtraWork,
      feeAddToOrder: order.feeAddToOrder,
      dontSendEmail: order.dontSendEmail,
      priceExVat: order.priceExVat,
      priceSubcontractor: order.priceSubcontractor,
      rabatt: order.rabatt,
      leggTil: order.leggTil,
      subcontractorMinus: order.subcontractorMinus,
      subcontractorPlus: order.subcontractorPlus,
      gsmLastTaskState: order.gsmLastTaskState,
    }),
    createdAt: order.createdAt,
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
        returnAddress: optionalString(body.returnAddress),
        drivingDistance: optionalString(body.drivingDistance),
        timeWindow: optionalString(body.timeWindow),
        expressDelivery: optionalBoolean(body.expressDelivery),
        description: optionalString(body.description),
        customerName,
        email,
        phone,
        floorNo: optionalString(body.floorNo),
        lift: optionalString(body.lift),
        cashierName: optionalString(body.cashierName),
        cashierPhone,
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

  const baseOrderBy = (() => {
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

  const orderBy = (
    Array.isArray(baseOrderBy) ? baseOrderBy : [baseOrderBy]
  ) as Prisma.OrderOrderByWithRelationInput[];

  if (isAdminOrOwner) {
    orderBy.unshift(
      { needsEmailAttention: "desc" },
      { lastInboundEmailAt: { sort: "desc", nulls: "last" } },
    );
  }

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
      expressDelivery: true,
      customerLabel: true,
      customerName: true,
      orderNumber: true,
      phone: true,
      email: true,
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
      lastInboundEmailAt: true,
      lastOutboundEmailAt: true,
      needsEmailAttention: true,
      unreadInboundEmailCount: true,
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
      expressDelivery: order.expressDelivery,
      customer: order.customerLabel ?? "",
      customerLabel: order.customerLabel ?? "",
      customerName: order.customerName ?? "",
      orderNumber: order.orderNumber ?? "",
      phone: order.phone ?? "",
      email: order.email ?? "",
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
      lastInboundEmailAt: order.lastInboundEmailAt,
      lastOutboundEmailAt: order.lastOutboundEmailAt,
      needsEmailAttention: order.needsEmailAttention,
      unreadInboundEmailCount: order.unreadInboundEmailCount,
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
