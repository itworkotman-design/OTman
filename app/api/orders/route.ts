import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canCreateOrders } from "@/lib/users/orderAccess";
import {
  optionalBoolean,
  optionalString,
  safeInteger,
  safeNumber,
} from "@/lib/orders/normalizeOrderInput";
import {
  getOptionalEmailError,
  getOptionalPhoneError,
  normalizeOptionalEmail,
  normalizeOptionalPhone,
} from "@/lib/orders/contactValidation";
import {
  getExtraPickupApiError,
  normalizeExtraPickups,
  parseExtraPickups,
} from "@/lib/orders/extraPickups";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import {
  sendExtraPickupNotificationEmail,
  sendOrderNotificationEmail,
} from "@/lib/orders/orderNotificationEmail";
import {
  buildOrderEventSnapshot,
  createOrderCreatedEvent,
} from "@/lib/orders/orderEvents";
import {
  normalizeSavedProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  ORDER_SLOT_LIMIT,
  countOrdersInDeliverySlot,
  isDeliverySlotOverCapacity,
} from "@/lib/orders/capacity";
import { buildCapacityWarningNotification } from "@/lib/orders/notificationTemplates/capacityWarningNotification";
import {
  createOrderNotification,
  hasOpenCapacityNotification,
  hasOpenSubcontractorPriceNotification,
} from "@/lib/orders/orderNotifications";
import { buildExtraPickupNotification } from "@/lib/orders/notificationTemplates/extraPickupNotification";
import { buildSubcontractorPriceWarningNotification } from "@/lib/orders/notificationTemplates/subcontractorPriceWarningNotification";
import {
  buildLegacyOrderSummaryGroups,
  buildOrderSummaryGroups,
  formatOrderSummaryText,
} from "@/lib/orders/orderSummary";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import {
  normalizedIncludes,
  normalizeSearchText,
} from "@/lib/searchNormalization";
import type { AppPermission } from "@/lib/users/types";
import {
  buildWordpressExtraPickupContacts,
  getWordpressExtraPickupAddresses,
  toWordpressMetaRecord,
} from "@/lib/integrations/wordpress/orderMeta";
import {
  applyOrderPricingSnapshot,
  getSavedOrderPricingSnapshot,
} from "@/lib/booking/pricing/snapshot";

const orderArchiveSelect = Prisma.validator<Prisma.OrderSelect>()({
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
  phoneTwo: true,
  email: true,
  pickupAddress: true,
  extraPickupAddress: true,
  extraPickupContacts: true,
  legacyWordpressRawMeta: true,
  deliveryAddress: true,
  returnAddress: true,
  items: {
    select: {
      cardId: true,
      productName: true,
      deliveryType: true,
      itemType: true,
      optionCode: true,
      optionLabel: true,
      quantity: true,
      rawData: true,
    },
  },
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
  lastNotificationAt: true,
  needsEmailAttention: true,
  unreadInboundEmailCount: true,
  needsNotificationAttention: true,
  unreadNotificationCount: true,
  priceExVat: true,
  priceSubcontractor: true,
  createdByMembershipId: true,
  lastEditedByMembershipId: true,
  customerMembershipId: true,
  legacyWordpressAuthorId: true,
  customerMembership: {
    select: {
      user: {
        select: {
          username: true,
          email: true,
        },
      },
    },
  },
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
});

type OrderArchiveRecord = Prisma.OrderGetPayload<{
  select: typeof orderArchiveSelect;
}>;

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function getMembershipUserLabel(user: {
  username: string | null;
  email: string;
} | null | undefined): string {
  if (!user) return "";
  const username = user.username?.trim();
  if (username) return username;
  return user.email.trim();
}

function orderMatchesSearch(order: OrderArchiveRecord, search: string) {
  const fields: Array<string | number | null | undefined> = [
    order.id,
    order.displayId,
    order.orderNumber,
    order.customerLabel,
    order.customerName,
    order.phone,
    order.phoneTwo,
    order.email,
    order.pickupAddress,
    ...order.extraPickupAddress,
    order.deliveryAddress,
    order.returnAddress,
    order.productsSummary,
    order.deliveryTypeSummary,
    order.servicesSummary,
    order.subcontractor,
    order.driver,
    order.description,
    order.cashierName,
    order.cashierPhone,
    order.customerComments,
    order.driverInfo,
    order.createdByMembership.user.username,
    order.createdByMembership.user.email,
    order.customerMembership?.user.username,
    order.customerMembership?.user.email,
  ];

  return fields.some((field) => normalizedIncludes(field, search));
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
      warehouseEmail: true,
      company: {
        select: {
          orderEmailsEnabled: true,
        },
      },
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
  const dontSendWarehouseEmail = optionalBoolean(body?.dontSendWarehouseEmail);

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
      {
        ok: false,
        reason: "INVALID_CASHIER_PHONE",
        message: cashierPhoneError,
      },
      { status: 400 },
    );
  }

  const email = normalizeOptionalEmail(body.email);
  const phone = normalizeOptionalPhone(body.phone);
  const phoneTwo = normalizeOptionalPhone(body.phoneTwo);
  const cashierPhone = normalizeOptionalPhone(body.cashierPhone);
  const parsedExtraPickups = parseExtraPickups(body.extraPickups);
  const extraPickupError = getExtraPickupApiError(parsedExtraPickups);

  if (extraPickupError) {
    return NextResponse.json(
      {
        ok: false,
        reason: "INVALID_EXTRA_PICKUP_CONTACT",
        message: extraPickupError,
      },
      { status: 400 },
    );
  }
  const extraPickups = normalizeExtraPickups(parsedExtraPickups);

  const isAdminOrOwner =
    membership.role === "OWNER" || membership.role === "ADMIN";

  const customerMembershipId =
    optionalString(body.customerMembershipId) || membership.id;

  const customerLabel =
    optionalString(body.customerLabel) ||
    membership.user.username ||
    membership.user.email;

  const customerName = optionalString(body.customerName);
  const deliveryDate = optionalString(body.deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deliveryDateObj = deliveryDate ? new Date(deliveryDate) : null;
  if (deliveryDateObj) {
    deliveryDateObj.setHours(0, 0, 0, 0);
  }

  const diffDays = deliveryDateObj
    ? (deliveryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    : null;

  const effectiveExpressDelivery =
    typeof diffDays === "number" && diffDays <= 1
      ? true
      : optionalBoolean(body.expressDelivery);

  // Important:
  // For admin-created orders, use the selected customer's pricelist if possible.
  let effectivePriceListId = membership.priceListId ?? null;
  const requestedPriceListId = optionalString(body.priceListId);

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

  if (isAdminOrOwner && requestedPriceListId) {
    const requestedPriceList = await prisma.priceList.findFirst({
      where: {
        id: requestedPriceListId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!requestedPriceList) {
      return NextResponse.json(
        { ok: false, reason: "PRICE_LIST_NOT_FOUND" },
        { status: 404 },
      );
    }

    effectivePriceListId = requestedPriceList.id;
  }

  const catalog = await getBookingCatalog(effectivePriceListId);
  const pricingSource = applyOrderPricingSnapshot({
    catalogProducts: catalog.products,
    catalogSpecialOptions: catalog.specialOptions,
    priceListSettings: catalog.priceListSettings,
    pricingSnapshot: getSavedOrderPricingSnapshot(productCards),
  });

  const summaries = buildOrderSummaries(
    productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
  );

  const builtItems = buildOrderItemsFromCards(
    productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
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

      deliveryDate,
      timeWindow: optionalString(body.timeWindow),
      expressDelivery: effectiveExpressDelivery,
      contactCustomerForCustomTimeWindow: optionalBoolean(
        body.contactCustomerForCustomTimeWindow,
      ),
      customTimeContactNote: optionalString(body.customTimeContactNote),

      pickupAddress: optionalString(body.pickupAddress),
      extraPickupAddress: extraPickups.map((pickup) => pickup.address),
      extraPickupContacts: extraPickups as unknown as Prisma.InputJsonValue,
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
      extraWorkMinutes: optionalBoolean(body.feeExtraWork)
        ? safeInteger(body.extraWorkMinutes)
        : 0,
      feeAddToOrder: optionalBoolean(body.feeAddToOrder),
      statusNotes: optionalString(body.statusNotes),
      status: optionalString(body.status) || "processing",
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
      extraWorkMinutes: order.extraWorkMinutes,
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

  if (extraPickups.length > 0) {
    const extraPickupNotification = buildExtraPickupNotification(extraPickups);

    await createOrderNotification(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      type: "MANUAL_REVIEW",
      title: extraPickupNotification.title,
      message: extraPickupNotification.message,
      payload:
        extraPickupNotification.payload as unknown as Prisma.InputJsonValue,
    });
  }

  if (order.priceSubcontractor > order.priceExVat) {
    const alreadyExists = await hasOpenSubcontractorPriceNotification(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      customerPrice: order.priceExVat,
      subcontractorPrice: order.priceSubcontractor,
    });

    if (!alreadyExists) {
      const priceWarning = buildSubcontractorPriceWarningNotification({
        customerPrice: order.priceExVat,
        subcontractorPrice: order.priceSubcontractor,
      });

      await createOrderNotification(prisma, {
        orderId: order.id,
        companyId: order.companyId,
        type: "MANUAL_REVIEW",
        title: priceWarning.title,
        message: priceWarning.message,
        payload: priceWarning.payload as unknown as Prisma.InputJsonValue,
      });
    }
  }

  const normalizedTimeWindow = optionalString(body.timeWindow);

  if (deliveryDate && normalizedTimeWindow) {
    const slotCount = await countOrdersInDeliverySlot(prisma, {
      companyId: order.companyId,
      deliveryDate,
      timeWindow: normalizedTimeWindow,
    });

    if (isDeliverySlotOverCapacity(slotCount, ORDER_SLOT_LIMIT)) {
      const alreadyExists = await hasOpenCapacityNotification(prisma, {
        orderId: order.id,
        companyId: order.companyId,
        deliveryDate,
        timeWindow: normalizedTimeWindow,
      });

      if (!alreadyExists) {
        const capacityNotification = buildCapacityWarningNotification({
          deliveryDate,
          timeWindow: normalizedTimeWindow,
          count: slotCount,
          limit: ORDER_SLOT_LIMIT,
        });

        await createOrderNotification(prisma, {
          orderId: order.id,
          companyId: order.companyId,
          type: "CAPACITY_REVIEW",
          title: capacityNotification.title,
          message: capacityNotification.message,
          payload:
            capacityNotification.payload as unknown as Prisma.InputJsonValue,
        });
      }
    }
  }

  try {
    const orderEmailsEnabled = membership.company?.orderEmailsEnabled !== false;
    if (orderEmailsEnabled) {
      const notificationOrder = {
        id: order.id,
        displayId: order.displayId,
        orderNumber: order.orderNumber,
        customerLabel,
        customerEmail: membership.user.email,
        deliveryDate,
        pickupAddress: optionalString(body.pickupAddress),
        extraPickupAddress: extraPickups.map((pickup) => pickup.address),
        deliveryAddress: optionalString(body.deliveryAddress),
        returnAddress: optionalString(body.returnAddress),
        drivingDistance: optionalString(body.drivingDistance),
        timeWindow: optionalString(body.timeWindow),
        expressDelivery: effectiveExpressDelivery,
        description: optionalString(body.description),
        customerName,
        email,
        phone,
        floorNo: optionalString(body.floorNo),
        lift: optionalString(body.lift),
        cashierName: optionalString(body.cashierName),
        cashierPhone,
        status: optionalString(body.status) || "processing",
        createdAt: order.createdAt,
        productsSummary: summaries.productsSummary,
        priceExVat: Math.round(safeNumber(body.priceExVat)),
      };

      await sendOrderNotificationEmail({
        kind: "created",
        order: notificationOrder,
        items: builtItems,
      });

      const warehouseEmail = normalizeOptionalEmail(membership.warehouseEmail);
      if (warehouseEmail && !dontSendWarehouseEmail) {
        await sendOrderNotificationEmail({
          kind: "created",
          order: notificationOrder,
          items: builtItems,
          recipientEmail: warehouseEmail,
        });
      }

      for (const pickup of extraPickups) {
        if (!pickup.sendEmail) continue;

        const pickupEmail = normalizeOptionalEmail(pickup.email);
        if (!pickupEmail) continue;

        await sendExtraPickupNotificationEmail({
          order: notificationOrder,
          extraPickup: {
            address: pickup.address,
            phone: normalizeOptionalPhone(pickup.phone) ?? "",
            email: pickupEmail,
          },
        });
      }
    }
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
  const normalizedSearch = normalizeSearchText(search);
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
      where.customerMembershipId = createdById;
    }
  } else if (isOrderCreator) {
    where.OR = [
      { customerMembershipId: membership.id },
      { createdByMembershipId: membership.id },
    ];
  } else {
    where.subcontractorMembershipId = membership.id;
  }

  if (status) {
    const normalizedStatus = normalizeOrderStatus(status);

    if (normalizedStatus === "failed") {
      where.status = {
        in: ["failed", "fail"],
      };
    } else {
      where.status = normalizedStatus;
    }
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
      { needsNotificationAttention: "desc" },
      { lastNotificationAt: { sort: "desc", nulls: "last" } },
      { needsEmailAttention: "desc" },
      { lastInboundEmailAt: { sort: "desc", nulls: "last" } },
    );
  }

  const orderFindManyArgs: Prisma.OrderFindManyArgs & {
    select: typeof orderArchiveSelect;
  } = {
    where,
    orderBy,
    select: orderArchiveSelect,
  };

  if (!normalizedSearch) {
    orderFindManyArgs.skip = (page - 1) * rowsPerPage;
    orderFindManyArgs.take = rowsPerPage;
  }

  const orderCandidates = (await prisma.order.findMany(
    orderFindManyArgs,
  )) as OrderArchiveRecord[];

  const orders = normalizedSearch
    ? orderCandidates
        .filter((order) => orderMatchesSearch(order, normalizedSearch))
        .slice((page - 1) * rowsPerPage, page * rowsPerPage)
    : orderCandidates;

  const legacyAuthorIds = Array.from(
    new Set(
      orders
        .map((order) => order.legacyWordpressAuthorId)
        .filter((legacyWordpressAuthorId): legacyWordpressAuthorId is number =>
          typeof legacyWordpressAuthorId === "number",
        ),
    ),
  );

  const legacyCreatorMemberships =
    legacyAuthorIds.length > 0
      ? await prisma.membership.findMany({
          where: {
            companyId: session.activeCompanyId,
            legacyWordpressUserId: {
              in: legacyAuthorIds,
            },
            status: "ACTIVE",
          },
          select: {
            legacyWordpressUserId: true,
            user: {
              select: {
                username: true,
                email: true,
              },
            },
          },
        })
      : [];

  const legacyCreatorLabels = new Map(
    legacyCreatorMemberships
      .filter(
        (
          legacyCreatorMembership,
        ): legacyCreatorMembership is typeof legacyCreatorMembership & {
          legacyWordpressUserId: number;
        } => typeof legacyCreatorMembership.legacyWordpressUserId === "number",
      )
      .map((legacyCreatorMembership) => [
        legacyCreatorMembership.legacyWordpressUserId,
        getMembershipUserLabel(legacyCreatorMembership.user),
      ]),
  );

  return NextResponse.json({
    ok: true,
    orders: orders.map((order) => {
      const orderItems = order.items ?? [];
      const fallbackExtraPickupAddresses =
        order.extraPickupAddress.length > 0
          ? order.extraPickupAddress
          : getWordpressExtraPickupAddresses(
              toWordpressMetaRecord(order.legacyWordpressRawMeta),
            );
      const extraPickupContacts = Array.isArray(order.extraPickupContacts)
        ? order.extraPickupContacts
        : buildWordpressExtraPickupContacts(fallbackExtraPickupAddresses);
      const orderSummaryGroups =
        orderItems.length > 0
          ? buildOrderSummaryGroups(orderItems)
          : buildLegacyOrderSummaryGroups({
              productsSummary: order.productsSummary,
              deliveryTypeSummary: order.deliveryTypeSummary,
              servicesSummary: order.servicesSummary,
            });

      const legacyCreatedBy =
        typeof order.legacyWordpressAuthorId === "number"
          ? legacyCreatorLabels.get(order.legacyWordpressAuthorId)
          : undefined;
      const createdBy = getMembershipUserLabel(order.createdByMembership.user);
      const assignedStore = getMembershipUserLabel(order.customerMembership?.user);
      const storeLabel = assignedStore || legacyCreatedBy || createdBy;

      return {
        id: order.id,
        displayId: order.displayId ?? 0,
        status: normalizeOrderStatus(order.status),
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
        extraPickupAddress: fallbackExtraPickupAddresses,
        extraPickupContacts,
        deliveryAddress: order.deliveryAddress ?? "",
        returnAddress: order.returnAddress ?? "",
        orderSummaryGroups,
        orderSummaryText: formatOrderSummaryText(orderSummaryGroups),
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
        lastNotificationAt: order.lastNotificationAt,
        needsEmailAttention: order.needsEmailAttention,
        unreadInboundEmailCount: order.unreadInboundEmailCount,
        needsNotificationAttention: order.needsNotificationAttention,
        unreadNotificationCount: order.unreadNotificationCount,
        priceExVat: order.priceExVat,
        priceSubcontractor: order.priceSubcontractor,
        createdByMembershipId: order.createdByMembershipId,
        lastEditedByMembershipId: order.lastEditedByMembershipId ?? "",
        customerMembershipId: order.customerMembershipId ?? "",
        createdBy: storeLabel,
        lastEditedBy: getMembershipUserLabel(order.lastEditedByMembership?.user),
      };
    }),
    page,
    rowsPerPage,
  });
}
