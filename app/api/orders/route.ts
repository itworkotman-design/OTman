import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canCreateOrders } from "@/lib/users/orderAccess";
import {
  optionalBoolean,
  optionalString,
  optionalStringArray,
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
import {
  normalizeSavedProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { createOrder } from "@/lib/orders/createOrder";
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
} from "@/lib/integrations/wordpress/orderMeta";
import { buildArchiveCalculatorItems } from "@/lib/orders/buildArchiveCalculatorItems";
import { NONE_FILTER_VALUE } from "@/lib/orders/archiveFilters";

const orderArchiveSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  displayId: true,
  status: true,
  statusNotes: true,
  deliveryDate: true,
  timeWindow: true,
  drivingDistance: true,
  expressDelivery: true,
  customerLabel: true,
  customerName: true,
  orderNumber: true,
  phone: true,
  phoneTwo: true,
  email: true,
  floorNo: true,
  lift: true,
  pickupAddress: true,
  extraPickupAddress: true,
  extraPickupContacts: true,
  deliveryAddress: true,
  returnAddress: true,
  items: {
    select: {
      cardId: true,
      productCode: true,
      productName: true,
      deliveryType: true,
      itemType: true,
      optionCode: true,
      optionLabel: true,
      quantity: true,
      customerPriceCents: true,
      subcontractorPriceCents: true,
      rawData: true,
    },
  },
  productsSummary: true,
  deliveryTypeSummary: true,
  servicesSummary: true,
  productCardsSnapshot: true,
  pricingSnapshot: true,
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
  orderCreatorEmailReadAt: true,
  lastNotificationAt: true,
  needsEmailAttention: true,
  unreadInboundEmailCount: true,
  needsNotificationAttention: true,
  unreadNotificationCount: true,
  priceExVat: true,
  priceSubcontractor: true,
  rabatt: true,
  dnbDiscount: true,
  leggTil: true,
  subcontractorMinus: true,
  subcontractorPlus: true,
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
  events: {
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
    select: {
      payload: true,
    },
  },
});

const orderArchiveCandidateSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  displayId: true,
  deliveryDate: true,
  timeWindow: true,
  customerLabel: true,
  customerName: true,
  orderNumber: true,
  phone: true,
  phoneTwo: true,
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
  subcontractor: true,
  driver: true,
  needsEmailAttention: true,
  unreadInboundEmailCount: true,
  needsNotificationAttention: true,
  unreadNotificationCount: true,
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
});

type OrderArchiveRecord = Prisma.OrderGetPayload<{
  select: typeof orderArchiveSelect;
}>;

type OrderArchiveCandidate = Prisma.OrderGetPayload<{
  select: typeof orderArchiveCandidateSelect;
}>;

function getLatestActionTitle(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidate = payload as {
    kind?: unknown;
    title?: unknown;
  };

  if (candidate.kind !== "action" || typeof candidate.title !== "string") {
    return "";
  }

  return candidate.title.trim();
}

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function buildArchiveSearchPrefilter(
  search: string,
  extraPickupOrderIds: string[] = [],
): Prisma.OrderWhereInput {
  const trimmedSearch = search.trim();

  if (!trimmedSearch) {
    return {};
  }

  const displayId = Number(trimmedSearch);
  const canSearchDisplayId = /^\d+$/.test(trimmedSearch) && Number.isSafeInteger(displayId) && displayId > 0 && displayId <= 2147483647;

  const orFilters: Prisma.OrderWhereInput[] = [
    { orderNumber: { contains: trimmedSearch, mode: "insensitive" } },
    { customerLabel: { contains: trimmedSearch, mode: "insensitive" } },
    { customerName: { contains: trimmedSearch, mode: "insensitive" } },
    { phone: { contains: trimmedSearch } },
    { phoneTwo: { contains: trimmedSearch } },
    { email: { contains: trimmedSearch, mode: "insensitive" } },
    { pickupAddress: { contains: trimmedSearch, mode: "insensitive" } },
    { deliveryAddress: { contains: trimmedSearch, mode: "insensitive" } },
    { returnAddress: { contains: trimmedSearch, mode: "insensitive" } },
    { productsSummary: { contains: trimmedSearch, mode: "insensitive" } },
    { deliveryTypeSummary: { contains: trimmedSearch, mode: "insensitive" } },
    { servicesSummary: { contains: trimmedSearch, mode: "insensitive" } },
    { description: { contains: trimmedSearch, mode: "insensitive" } },
    { cashierName: { contains: trimmedSearch, mode: "insensitive" } },
    { cashierPhone: { contains: trimmedSearch } },
    { customerComments: { contains: trimmedSearch, mode: "insensitive" } },
    { driverInfo: { contains: trimmedSearch, mode: "insensitive" } },
    { subcontractor: { contains: trimmedSearch, mode: "insensitive" } },
    { driver: { contains: trimmedSearch, mode: "insensitive" } },
  ];

  if (canSearchDisplayId) {
    orFilters.push({ displayId });
  }

  if (extraPickupOrderIds.length > 0) {
    orFilters.push({ id: { in: extraPickupOrderIds } });
  }

  return {
    OR: orFilters,
  };
}

// extraPickupAddress is a Postgres text[] column, which Prisma's type-safe
// filters can only match by exact element (`has`/`hasSome`), not substring.
// Find matching order ids with a raw ILIKE-over-unnest query so the archive
// search prefilter doesn't drop orders whose only match is an extra pickup.
async function findExtraPickupAddressOrderIds(companyId: string, search: string) {
  const trimmedSearch = search.trim();

  if (!trimmedSearch) {
    return [];
  }

  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT DISTINCT o."id"
      FROM "Order" o
      CROSS JOIN LATERAL unnest(o."extraPickupAddress") AS "address"
      WHERE o."companyId" = ${companyId}
        AND "address" ILIKE ${`%${trimmedSearch}%`}
    `,
  );

  return rows.map((row) => row.id);
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

function orderMatchesSearch(order: OrderArchiveCandidate, search: string) {
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

function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hasArchiveAlert(order: Pick<
  OrderArchiveCandidate,
  | "needsNotificationAttention"
  | "unreadNotificationCount"
  | "needsEmailAttention"
  | "unreadInboundEmailCount"
>) {
  return Boolean(
    order.needsNotificationAttention ||
    order.unreadNotificationCount > 0 ||
    order.needsEmailAttention ||
    order.unreadInboundEmailCount > 0
  );
}

function getOrderCreatorEmailAttention(order: OrderArchiveRecord) {
  if (!order.lastOutboundEmailAt) {
    return {
      needsEmailAttention: false,
      unreadInboundEmailCount: 0,
    };
  }

  const lastInboundTime = order.lastInboundEmailAt?.getTime() ?? 0;
  const lastOutboundTime = order.lastOutboundEmailAt.getTime();
  const readTime = order.orderCreatorEmailReadAt?.getTime() ?? 0;
  const hasUnreadAdminReply =
    lastOutboundTime > lastInboundTime && lastOutboundTime > readTime;

  return {
    needsEmailAttention: hasUnreadAdminReply,
    unreadInboundEmailCount: hasUnreadAdminReply ? 1 : 0,
  };
}

function getArchiveEmailAttention(
  order: OrderArchiveRecord,
  isOrderCreator: boolean,
) {
  if (isOrderCreator) {
    return getOrderCreatorEmailAttention(order);
  }

  return {
    needsEmailAttention: order.needsEmailAttention,
    unreadInboundEmailCount: order.unreadInboundEmailCount,
  };
}

function getDeliveryDateGroup(deliveryDate: string | null, todayDateKey: string) {
  if (!deliveryDate) {
    return 2;
  }

  return deliveryDate >= todayDateKey ? 0 : 1;
}

function compareNullableText(left: string | null, right: string | null) {
  const leftValue = left?.trim() ?? "";
  const rightValue = right?.trim() ?? "";

  if (!leftValue && !rightValue) {
    return 0;
  }

  if (!leftValue) {
    return 1;
  }

  if (!rightValue) {
    return -1;
  }

  return leftValue.localeCompare(rightValue, "no");
}

function compareArchiveOrders(todayDateKey: string) {
  return (left: OrderArchiveCandidate, right: OrderArchiveCandidate) => {
    const alertComparison = Number(hasArchiveAlert(right)) - Number(hasArchiveAlert(left));
    if (alertComparison !== 0) {
      return alertComparison;
    }

    const leftDateGroup = getDeliveryDateGroup(left.deliveryDate, todayDateKey);
    const rightDateGroup = getDeliveryDateGroup(right.deliveryDate, todayDateKey);
    if (leftDateGroup !== rightDateGroup) {
      return leftDateGroup - rightDateGroup;
    }

    if (left.deliveryDate !== right.deliveryDate) {
      if (!left.deliveryDate) {
        return 1;
      }

      if (!right.deliveryDate) {
        return -1;
      }

      return right.deliveryDate.localeCompare(left.deliveryDate);
    }

    const timeWindowComparison = compareNullableText(left.timeWindow, right.timeWindow);
    if (timeWindowComparison !== 0) {
      return timeWindowComparison;
    }

    return (right.displayId ?? 0) - (left.displayId ?? 0);
  };
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
      membershipPriceLists: {
        select: { priceListId: true },
      },
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
  const submittedOrderNumber = optionalString(body.orderNumber);

  if (
    !submittedOrderNumber &&
    membership.role !== "OWNER" &&
    membership.role !== "ADMIN"
  ) {
    return NextResponse.json(
      {
        ok: false,
        reason: "ORDER_NUMBER_REQUIRED",
        message: "Order number is required.",
      },
      { status: 400 },
    );
  }

  const isAdminOrOwner =
    membership.role === "OWNER" || membership.role === "ADMIN";
  const dnbDiscount = isAdminOrOwner && optionalBoolean(body.dnbDiscount);

  const customerMembershipId =
    optionalString(body.customerMembershipId) || membership.id;

  const customerLabel =
    optionalString(body.customerLabel) ||
    membership.user.username ||
    membership.user.email;

  const customerName = optionalString(body.customerName);
  const deliveryDate = optionalString(body.deliveryDate);

  const membershipPriceListIds = membership.membershipPriceLists.map((item) => item.priceListId);
  let effectivePriceListId = membershipPriceListIds[0] ?? null;
  const requestedPriceListId = optionalString(body.priceListId);

  if (isAdminOrOwner && customerMembershipId) {
    const selectedCustomerMembership = await prisma.membership.findFirst({
      where: {
        id: customerMembershipId,
        companyId: session.activeCompanyId,
        status: "ACTIVE",
      },
      select: {
        membershipPriceLists: {
          select: { priceListId: true },
        },
      },
    });

    effectivePriceListId =
      selectedCustomerMembership?.membershipPriceLists[0]?.priceListId ??
      membershipPriceListIds[0] ?? null;
  }

  if (!isAdminOrOwner && requestedPriceListId) {
    if (!membershipPriceListIds.includes(requestedPriceListId)) {
      return NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 },
      );
    }

    effectivePriceListId = requestedPriceListId;
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

  const orderEmailsEnabled = membership.company?.orderEmailsEnabled !== false;

  const order = await createOrder({
    companyId: session.activeCompanyId,
    membershipId: membership.id,
    orderNumber: submittedOrderNumber,
    productCards,
    priceListId: effectivePriceListId,
    actor: {
      name: membership.user.username ?? null,
      email: membership.user.email,
      source: "USER",
    },
    companyOrderEmailsEnabled: orderEmailsEnabled,
    linkPendingAttachmentsForSessionId: session.userId,
    fields: {
      description: optionalString(body.description),
      modelNr: optionalString(body.modelNr),
      deliveryDate,
      timeWindow: optionalString(body.timeWindow),
      expressDelivery: optionalBoolean(body.expressDelivery),
      contactCustomerForCustomTimeWindow: optionalBoolean(
        body.contactCustomerForCustomTimeWindow,
      ),
      customTimeContactNote: optionalString(body.customTimeContactNote),
      pickupAddress: optionalString(body.pickupAddress),
      extraPickups,
      returnAddress: optionalString(body.returnAddress),
      deliveryAddress: optionalString(body.deliveryAddress),
      drivingDistance: optionalString(body.drivingDistance),
      customerName,
      phone,
      phoneTwo,
      email,
      customerComments: optionalString(body.customerComments),
      floorNo: optionalString(body.floorNo),
      lift: optionalString(body.lift),
      cashierName: optionalString(body.cashierName),
      cashierPhone,
      subcontractorId: optionalString(body.subcontractorId),
      subcontractor: optionalString(body.subcontractor),
      driver: optionalString(body.driver),
      secondDriver: optionalString(body.secondDriver),
      driverInfo: optionalString(body.driverInfo),
      licensePlate: optionalString(body.licensePlate),
      deviation: optionalString(body.deviation),
      feeExtraWork: optionalBoolean(body.feeExtraWork),
      extraWorkMinutes: safeInteger(body.extraWorkMinutes),
      feeAddToOrder: optionalBoolean(body.feeAddToOrder),
      statusNotes: optionalString(body.statusNotes),
      status: optionalString(body.status),
      dontSendEmail: optionalBoolean(body.dontSendEmail),
      rabatt: optionalString(body.rabatt),
      dnbDiscount,
      leggTil: optionalString(body.leggTil),
      subcontractorMinus: optionalString(body.subcontractorMinus),
      subcontractorPlus: optionalString(body.subcontractorPlus),
      nulledOrderExtraKeysForCustomer: optionalStringArray(body.nulledOrderExtraKeysForCustomer),
      nulledOrderExtraKeysForSubcontractor: optionalStringArray(body.nulledOrderExtraKeysForSubcontractor),
      customerMembershipId,
      customerLabel,
      priceExVat: safeNumber(body.priceExVat),
      priceSubcontractor: safeNumber(body.priceSubcontractor),
    },
  });

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
  const trimmedSearch = search?.trim() ?? "";

  const page = parsePositiveInt(searchParams.get("page"), 1);
  const rowsPerPage = Math.min(
    10000,
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
      where.subcontractorMembershipId =
        subcontractorId === NONE_FILTER_VALUE ? null : subcontractorId;
    }

    if (createdById) {
      if (createdById === NONE_FILTER_VALUE) {
        where.customerMembershipId = null;
      } else {
        where.OR = [
          { customerMembershipId: createdById },
          { customerMembershipId: null, createdByMembershipId: createdById },
        ];
      }
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

  const orderFindManyArgs: Prisma.OrderFindManyArgs & {
    select: typeof orderArchiveCandidateSelect;
  } = {
    where,
    orderBy: [
      { needsNotificationAttention: "desc" },
      { needsEmailAttention: "desc" },
      { deliveryDate: { sort: "asc", nulls: "last" } },
      { timeWindow: { sort: "asc", nulls: "last" } },
      { displayId: "desc" },
    ],
    select: orderArchiveCandidateSelect,
  };

  if (trimmedSearch) {
    const extraPickupOrderIds = await findExtraPickupAddressOrderIds(
      session.activeCompanyId,
      trimmedSearch,
    );

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      buildArchiveSearchPrefilter(trimmedSearch, extraPickupOrderIds),
    ];
  }

  const orderCandidates = (await prisma.order.findMany(
    orderFindManyArgs,
  )) as OrderArchiveCandidate[];

  const todayDateKey = getTodayDateKey();
  const sortedOrders = orderCandidates.toSorted(compareArchiveOrders(todayDateKey));
  const matchedOrders = normalizedSearch
    ? sortedOrders.filter((order) => orderMatchesSearch(order, normalizedSearch))
    : sortedOrders;
  const pageOrderIds = matchedOrders
    .slice((page - 1) * rowsPerPage, page * rowsPerPage)
    .map((order) => order.id);

  const pageOrderPosition = new Map(
    pageOrderIds.map((orderId, index) => [orderId, index]),
  );

  const orders =
    pageOrderIds.length > 0
      ? ((await prisma.order.findMany({
          where: {
            id: {
              in: pageOrderIds,
            },
          },
          select: orderArchiveSelect,
        })) as OrderArchiveRecord[]).toSorted(
          (left, right) =>
            (pageOrderPosition.get(left.id) ?? 0) -
            (pageOrderPosition.get(right.id) ?? 0),
        )
      : [];

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
      const calculatorItems = buildArchiveCalculatorItems({
        orderItems,
        productCardsSnapshot: order.productCardsSnapshot,
      });
      const fallbackExtraPickupAddresses = order.extraPickupAddress;
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
      const latestEvent = order.events?.[0];
      const latestActionTitle = getLatestActionTitle(latestEvent?.payload);
      const emailAttention = getArchiveEmailAttention(order, isOrderCreator);

      return {
        id: order.id,
        displayId: order.displayId ?? 0,
        status: normalizeOrderStatus(order.status),
        statusNotes: order.statusNotes ?? "",
        deliveryDate: order.deliveryDate ?? "",
        timeWindow: order.timeWindow ?? "",
        drivingDistance: order.drivingDistance ?? "",
        expressDelivery: order.expressDelivery,
        customer: order.customerLabel ?? "",
        customerLabel: order.customerLabel ?? "",
        customerName: order.customerName ?? "",
        orderNumber: order.orderNumber ?? "",
        phone: order.phone ?? "",
        email: order.email ?? "",
        floorNo: order.floorNo ?? "",
        lift: order.lift ?? "",
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
        needsEmailAttention: emailAttention.needsEmailAttention,
        unreadInboundEmailCount: emailAttention.unreadInboundEmailCount,
        needsNotificationAttention: isOrderCreator ? false : order.needsNotificationAttention,
        unreadNotificationCount: isOrderCreator ? 0 : order.unreadNotificationCount,
        priceExVat: order.priceExVat,
        priceSubcontractor: order.priceSubcontractor,
        pricingSnapshot: order.pricingSnapshot,
        rabatt: order.rabatt ?? "",
        dnbDiscount: order.dnbDiscount,
        leggTil: order.leggTil ?? "",
        subcontractorMinus: order.subcontractorMinus ?? "",
        subcontractorPlus: order.subcontractorPlus ?? "",
        calculatorItems,
        createdByMembershipId: order.createdByMembershipId,
        lastEditedByMembershipId: order.lastEditedByMembershipId ?? "",
        customerMembershipId: order.customerMembershipId ?? "",
        createdBy: storeLabel,
        lastEditedBy: latestActionTitle || getMembershipUserLabel(order.lastEditedByMembership?.user),
      };
    }),
    page,
    rowsPerPage,
  });
}
