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
import {
  getOptionalEmailError,
  getOptionalPhoneError,
  normalizeOptionalEmail,
  normalizeOptionalPhone,
} from "@/lib/orders/contactValidation";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { sendOrderNotificationEmail } from "@/lib/orders/orderNotificationEmail";
import {
  buildOrderEventSnapshot,
  type OrderEventProductChange,
  createOrderStatusChangedEvent,
  createOrderUpdatedEvent,
  diffOrderEventSnapshots,
} from "@/lib/orders/orderEvents";
import {
  type CatalogProduct,
  type CatalogSpecialOption,
  normalizeSavedProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { getProductDeliveryTypeLabel } from "@/lib/products/deliveryTypes";
import type { AppPermission } from "@/lib/users/types";

type ProductChangeValue = {
  label: string;
  value: string;
};

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-";
}

function buildOptionLookup(
  products: CatalogProduct[],
  specialOptions: CatalogSpecialOption[],
) {
  const optionLookup = new Map<string, string>();

  for (const product of products) {
    optionLookup.set(product.id, product.label);

    for (const option of product.options) {
      optionLookup.set(option.id, option.label);
    }

    for (const section of product.customSections) {
      optionLookup.set(section.id, section.title || section.id);

      for (const option of section.options) {
        optionLookup.set(option.id, option.label || option.code || option.id);
      }
    }
  }

  for (const option of specialOptions) {
    optionLookup.set(option.id, option.label || option.code || option.id);
  }

  return optionLookup;
}

function describeCustomSelections(
  card: SavedProductCard,
  optionLookup: Map<string, string>,
) {
  if (card.customSectionSelections.length === 0) {
    return "-";
  }

  return card.customSectionSelections
    .map((selection) => {
      const sectionLabel =
        optionLookup.get(selection.sectionId) || selection.sectionId;
      const optionLabels = selection.optionIds.map(
        (optionId) => optionLookup.get(optionId) || optionId,
      );

      return `${sectionLabel}: ${formatList(optionLabels)}`;
    })
    .join(" | ");
}

function getProductCardValues(
  card: SavedProductCard,
  optionLookup: Map<string, string>,
  productLookup: Map<string, CatalogProduct>,
) {
  const productLabel = card.productId
    ? optionLookup.get(card.productId) || card.productId
    : "Unselected product";
  const product = card.productId ? productLookup.get(card.productId) ?? null : null;
  const values: ProductChangeValue[] = [
    { label: "Product", value: productLabel },
    {
      label: "Delivery type",
      value:
        product?.allowDeliveryTypes && card.deliveryType
          ? getProductDeliveryTypeLabel(product.deliveryTypes, card.deliveryType)
          : "-",
    },
    { label: "Amount", value: String(card.amount) },
  ];

  if (card.peopleCount !== 1) {
    values.push({ label: "People count", value: String(card.peopleCount) });
  }

  if (card.hoursInput !== 1) {
    values.push({ label: "Hours", value: String(card.hoursInput) });
  }

  if (card.selectedInstallOptionIds.length > 0) {
    values.push({
      label: "Install options",
      value: formatList(
        card.selectedInstallOptionIds.map(
          (optionId) => optionLookup.get(optionId) || optionId,
        ),
      ),
    });
  }

  if (card.selectedExtraOptionIds.length > 0) {
    values.push({
      label: "Extra options",
      value: formatList(
        card.selectedExtraOptionIds.map(
          (optionId) => optionLookup.get(optionId) || optionId,
        ),
      ),
    });
  }

  if (card.selectedReturnOptionId) {
    values.push({
      label: "Return option",
      value: optionLookup.get(card.selectedReturnOptionId) || card.selectedReturnOptionId,
    });
  }

  if (card.demontEnabled) {
    values.push({ label: "Demont", value: "Yes" });
  }

  if (card.selectedTimeOptionIds.length > 0) {
    values.push({
      label: "Time options",
      value: formatList(
        card.selectedTimeOptionIds.map(
          (optionId) => optionLookup.get(optionId) || optionId,
        ),
      ),
    });
  }

  if (card.extraTimeHours !== 0.5) {
    values.push({
      label: "Extra time hours",
      value: String(card.extraTimeHours),
    });
  }

  if (card.extraPalletEnabled) {
    values.push({
      label: "Extra pallet",
      value: `${card.extraPalletQty}`,
    });
  }

  if (card.etterEnabled) {
    values.push({
      label: "Etter",
      value: `${card.etterQty}`,
    });
  }

  if (card.customSectionSelections.length > 0) {
    values.push({
      label: "Custom selections",
      value: describeCustomSelections(card, optionLookup),
    });
  }

  return values;
}

function diffProductCards(
  previousCards: SavedProductCard[],
  nextCards: SavedProductCard[],
  optionLookup: Map<string, string>,
  productLookup: Map<string, CatalogProduct>,
): OrderEventProductChange[] {
  const previousMap = new Map(previousCards.map((card) => [card.cardId, card]));
  const nextMap = new Map(nextCards.map((card) => [card.cardId, card]));
  const cardIds = Array.from(
    new Set([...previousMap.keys(), ...nextMap.keys()]),
  ).sort((a, b) => a - b);

  const productChanges: OrderEventProductChange[] = [];

  for (const cardId of cardIds) {
    const previousCard = previousMap.get(cardId);
    const nextCard = nextMap.get(cardId);
    const titleSource = nextCard ?? previousCard;

    if (!titleSource) {
      continue;
    }

    const productLabel = titleSource.productId
      ? optionLookup.get(titleSource.productId) || titleSource.productId
      : `Product card ${cardId}`;
    const title = `${productLabel} (card ${cardId})`;

    if (!previousCard && nextCard) {
      productChanges.push({
        cardId,
        title,
        changeType: "ADDED",
        changes: getProductCardValues(nextCard, optionLookup, productLookup).map((item) => ({
          label: item.label,
          previousValue: "-",
          nextValue: item.value,
        })),
      });
      continue;
    }

    if (previousCard && !nextCard) {
      productChanges.push({
        cardId,
        title,
        changeType: "REMOVED",
        changes: getProductCardValues(previousCard, optionLookup, productLookup).map((item) => ({
          label: item.label,
          previousValue: item.value,
          nextValue: "-",
        })),
      });
      continue;
    }

    if (!previousCard || !nextCard) {
      continue;
    }

    const previousValues = getProductCardValues(
      previousCard,
      optionLookup,
      productLookup,
    );
    const nextValues = getProductCardValues(nextCard, optionLookup, productLookup);
    const valueLabels = Array.from(
      new Set([
        ...previousValues.map((item) => item.label),
        ...nextValues.map((item) => item.label),
      ]),
    );
    const cardChanges = valueLabels
      .map((label) => {
        const previousValue =
          previousValues.find((item) => item.label === label)?.value || "-";
        const nextValue =
          nextValues.find((item) => item.label === label)?.value || "-";

        if (previousValue === nextValue) {
          return null;
        }

        return {
          label,
          previousValue,
          nextValue,
        };
      })
      .filter(
        (
          change,
        ): change is OrderEventProductChange["changes"][number] => change !== null,
      );

    if (cardChanges.length > 0) {
      productChanges.push({
        cardId,
        title,
        changeType: "UPDATED",
        changes: cardChanges,
      });
    }
  }

  return productChanges;
}

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
      expressDelivery: true,
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
      expressDelivery: order.expressDelivery,
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
      companyId: true,
      displayId: true,
      orderNumber: true,
      productCardsSnapshot: true,
      priceListId: true,
      customerMembershipId: true,
      customerLabel: true,
      createdAt: true,
      status: true,
      statusNotes: true,
      customerName: true,
      deliveryDate: true,
      timeWindow: true,
      expressDelivery: true,
      pickupAddress: true,
      extraPickupAddress: true,
      deliveryAddress: true,
      returnAddress: true,
      drivingDistance: true,
      phone: true,
      phoneTwo: true,
      email: true,
      customerComments: true,
      description: true,
      productsSummary: true,
      deliveryTypeSummary: true,
      servicesSummary: true,
      cashierName: true,
      cashierPhone: true,
      subcontractor: true,
      driver: true,
      secondDriver: true,
      driverInfo: true,
      licensePlate: true,
      deviation: true,
      feeExtraWork: true,
      feeAddToOrder: true,
      dontSendEmail: true,
      priceExVat: true,
      priceSubcontractor: true,
      rabatt: true,
      leggTil: true,
      subcontractorMinus: true,
      subcontractorPlus: true,
      gsmLastTaskState: true,
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
  const optionLookup = buildOptionLookup(catalog.products, catalog.specialOptions);
  const productLookup = new Map(
    catalog.products.map((product) => [product.id, product]),
  );
  const previousProductCards = Array.isArray(existingOrder.productCardsSnapshot)
    ? existingOrder.productCardsSnapshot.map((card, index) =>
        normalizeSavedProductCard(card as Partial<SavedProductCard>, index),
      )
    : [];
  const productChanges = diffProductCards(
    previousProductCards,
    productCards,
    optionLookup,
    productLookup,
  );

  const previousSnapshot = buildOrderEventSnapshot(existingOrder);
  const nextSnapshot = buildOrderEventSnapshot({
    displayId: existingOrder.displayId,
    orderNumber: optionalString(body.orderNumber) ?? existingOrder.orderNumber,
    status: optionalString(body.status) ?? existingOrder.status,
    statusNotes: optionalString(body.statusNotes) ?? existingOrder.statusNotes,
    customerLabel:
      optionalString(body.customerLabel) ?? existingOrder.customerLabel,
    customerName: optionalString(body.customerName) ?? existingOrder.customerName,
    deliveryDate: optionalString(body.deliveryDate) ?? existingOrder.deliveryDate,
    timeWindow: optionalString(body.timeWindow) ?? existingOrder.timeWindow,
    expressDelivery:
      body.expressDelivery === undefined
        ? existingOrder.expressDelivery
        : optionalBoolean(body.expressDelivery),
    pickupAddress:
      optionalString(body.pickupAddress) ?? existingOrder.pickupAddress,
    extraPickupAddress: Array.isArray(body.extraPickupAddress)
      ? body.extraPickupAddress
          .filter(
            (value: unknown): value is string => typeof value === "string",
          )
          .map((value: string) => value.trim())
          .filter(Boolean)
      : existingOrder.extraPickupAddress,
    deliveryAddress:
      optionalString(body.deliveryAddress) ?? existingOrder.deliveryAddress,
    returnAddress:
      optionalString(body.returnAddress) ?? existingOrder.returnAddress,
    drivingDistance:
      optionalString(body.drivingDistance) ?? existingOrder.drivingDistance,
    phone: phone ?? existingOrder.phone,
    phoneTwo: phoneTwo ?? existingOrder.phoneTwo,
    email: email ?? existingOrder.email,
    customerComments:
      optionalString(body.customerComments) ?? existingOrder.customerComments,
    description: optionalString(body.description) ?? existingOrder.description,
    productsSummary: summaries.productsSummary,
    deliveryTypeSummary: summaries.deliveryTypeSummary,
    servicesSummary: summaries.servicesSummary,
    cashierName: optionalString(body.cashierName) ?? existingOrder.cashierName,
    cashierPhone: cashierPhone ?? existingOrder.cashierPhone,
    subcontractor:
      optionalString(body.subcontractor) ?? existingOrder.subcontractor,
    driver: optionalString(body.driver) ?? existingOrder.driver,
    secondDriver: optionalString(body.secondDriver) ?? existingOrder.secondDriver,
    driverInfo: optionalString(body.driverInfo) ?? existingOrder.driverInfo,
    licensePlate:
      optionalString(body.licensePlate) ?? existingOrder.licensePlate,
    deviation: optionalString(body.deviation) ?? existingOrder.deviation,
    feeExtraWork: optionalBoolean(body.feeExtraWork),
    feeAddToOrder: optionalBoolean(body.feeAddToOrder),
    dontSendEmail: optionalBoolean(body.dontSendEmail),
    priceExVat: Math.round(safeNumber(body.priceExVat)),
    priceSubcontractor: Math.round(safeNumber(body.priceSubcontractor)),
    rabatt: optionalString(body.rabatt) ?? existingOrder.rabatt,
    leggTil: optionalString(body.leggTil) ?? existingOrder.leggTil,
    subcontractorMinus:
      optionalString(body.subcontractorMinus) ?? existingOrder.subcontractorMinus,
    subcontractorPlus:
      optionalString(body.subcontractorPlus) ?? existingOrder.subcontractorPlus,
    gsmLastTaskState: existingOrder.gsmLastTaskState,
  });

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
        expressDelivery: optionalBoolean(body.expressDelivery),

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

  const changes = diffOrderEventSnapshots(previousSnapshot, nextSnapshot);

  if (
    productChanges.length === 0 &&
    changes.length === 1 &&
    changes[0]?.field === "status"
  ) {
    await createOrderStatusChangedEvent(prisma, {
      orderId,
      companyId: existingOrder.companyId,
      actor: {
        membershipId: membership.id,
        name: membership.user.username ?? null,
        email: membership.user.email,
        source: "USER",
      },
      fromStatus: previousSnapshot.status,
      toStatus: nextSnapshot.status,
      note: nextSnapshot.statusNotes,
    });
  } else {
    await createOrderUpdatedEvent(prisma, {
      orderId,
      companyId: existingOrder.companyId,
      actor: {
        membershipId: membership.id,
        name: membership.user.username ?? null,
        email: membership.user.email,
        source: "USER",
      },
      changes,
      productChanges,
    });
  }

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
        returnAddress: optionalString(body.returnAddress),
        drivingDistance: optionalString(body.drivingDistance),
        timeWindow: optionalString(body.timeWindow),
        expressDelivery:
          body.expressDelivery === undefined
            ? existingOrder.expressDelivery
            : optionalBoolean(body.expressDelivery),
        description: optionalString(body.description),
        customerName: optionalString(body.customerName),
        email,
        phone,
        floorNo: optionalString(body.floorNo),
        lift: optionalString(body.lift),
        cashierName: optionalString(body.cashierName),
        cashierPhone,
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
