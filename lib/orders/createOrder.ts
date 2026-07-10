import { Prisma } from "@prisma/client";
import type { Order } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reserveNextManualOrderNumber } from "@/lib/orders/orderNumber";
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
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  ORDER_SLOT_LIMIT,
  countOrdersInDeliverySlot,
  isDeliverySlotOverCapacity,
} from "@/lib/orders/capacity";
import {
  createCapacityAlert,
  createContactCustomerAlert,
  createExtraPickupAlert,
  createNoDeliveryDateAlert,
  createSubcontractorPriceAlert,
  createTodayDeliveryAlert,
} from "@/lib/orders/alerts";
import type { ExtraPickupInput } from "@/lib/orders/extraPickups";
import { normalizeOptionalEmail, normalizeOptionalPhone } from "@/lib/orders/contactValidation";
import {
  applyOrderPricingSnapshot,
  getSavedOrderPricingSnapshot,
} from "@/lib/booking/pricing/snapshot";
import { buildOrderPricingSnapshot } from "@/lib/orders/orderTotals";
import { computeFullOrderTotal } from "@/lib/booking/pricing/computeOrderTotal";

export type CreateOrderFields = {
  description: string | null;
  modelNr: string | null;
  deliveryDate: string | null;
  timeWindow: string | null;
  expressDelivery: boolean;
  contactCustomerForCustomTimeWindow: boolean;
  customTimeContactNote: string | null;
  pickupAddress: string | null;
  extraPickups: ExtraPickupInput[];
  returnAddress: string | null;
  deliveryAddress: string | null;
  drivingDistance: string | null;
  customerName: string | null;
  phone: string | null;
  phoneTwo: string | null;
  email: string | null;
  customerComments: string | null;
  floorNo: string | null;
  lift: string | null;
  cashierName: string | null;
  cashierPhone: string | null;
  subcontractorId: string | null;
  subcontractor: string | null;
  driver: string | null;
  secondDriver: string | null;
  driverInfo: string | null;
  licensePlate: string | null;
  deviation: string | null;
  feeExtraWork: boolean;
  extraWorkMinutes: number;
  feeAddToOrder: boolean;
  statusNotes: string | null;
  status: string | null;
  dontSendEmail: boolean;
  rabatt: string | null;
  dnbDiscount: boolean;
  leggTil: string | null;
  subcontractorMinus: string | null;
  subcontractorPlus: string | null;
  customerMembershipId: string;
  customerLabel: string;
  // Fallback totals used only when the caller has a real client-submitted
  // total to trust over the line-item summation (manual booking submission
  // always has one). Omit entirely — do not pass 0 — when there is no such
  // fallback: `buildOrderPricingSnapshot` treats any provided number,
  // including a literal 0, as authoritative and will use it instead of
  // summing the priced lines.
  priceExVat?: number;
  priceSubcontractor?: number;
};

export type CreateOrderInput = {
  companyId: string;
  membershipId: string;
  orderNumber: string | null;
  productCards: SavedProductCard[];
  priceListId: string | null;
  fields: CreateOrderFields;
  actor: { name: string | null; email: string; source: "USER" | "SYSTEM" };
  companyOrderEmailsEnabled: boolean;
  recurringOrderTemplateId?: string;
  recurringOrderOccurrenceDate?: string;
  // Session id whose pending attachment uploads should be linked to the new
  // order. Omitted by non-interactive callers (cron / manual generation),
  // which have no session and nothing pending to link.
  linkPendingAttachmentsForSessionId?: string;
};

// Throws on failure (invalid catalog/pricing lookups, DB errors, etc.) —
// callers (the HTTP route, or the recurring-order generator) are
// responsible for catching and translating failures for their own context.
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { fields } = input;

  const catalog = await getBookingCatalog(input.priceListId);
  const pricingSource = applyOrderPricingSnapshot({
    catalogProducts: catalog.products,
    catalogSpecialOptions: catalog.specialOptions,
    priceListSettings: catalog.priceListSettings,
    pricingSnapshot: getSavedOrderPricingSnapshot(input.productCards),
  });

  const summaries = buildOrderSummaries(
    input.productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
  );

  const builtItems = buildOrderItemsFromCards(
    input.productCards,
    pricingSource.catalogProducts,
    pricingSource.catalogSpecialOptions,
  );

  // buildOrderItemsFromCards only produces per-product-card line items — it
  // does not include order-level fees (express delivery, extra pickup,
  // deviation, extra work, add-to-order, distance charges). A manual booking
  // submission always carries its own client-computed total (which does
  // include those), but a caller with no such total (e.g. the automatic
  // order generator) needs the same full computation run server-side,
  // otherwise the stored total silently under-counts everything BookingEditor
  // shows under "Order extras".
  const hasSubmittedTotal = typeof fields.priceExVat === "number";
  const computedFullTotal = hasSubmittedTotal
    ? null
    : computeFullOrderTotal({
        productCards: input.productCards,
        catalogProducts: pricingSource.catalogProducts,
        catalogSpecialOptions: pricingSource.catalogSpecialOptions,
        priceListSettings: pricingSource.priceListSettings,
        deviation: fields.deviation ?? "",
        drivingDistance: fields.drivingDistance ?? "",
        expressDelivery: fields.expressDelivery,
        extraWorkMinutes: fields.extraWorkMinutes,
        feeAddToOrder: fields.feeAddToOrder,
        feeExtraWork: fields.feeExtraWork,
        extraPickups: fields.extraPickups,
        rabatt: fields.rabatt,
        leggTil: fields.leggTil,
        subcontractorMinus: fields.subcontractorMinus,
        subcontractorPlus: fields.subcontractorPlus,
      });

  const pricingSnapshot = buildOrderPricingSnapshot({
    lines: builtItems,
    rabatt: fields.rabatt,
    leggTil: fields.leggTil,
    subcontractorMinus: fields.subcontractorMinus,
    subcontractorPlus: fields.subcontractorPlus,
    fallbackCustomerTotalExVat: hasSubmittedTotal
      ? Math.round(fields.priceExVat as number)
      : Math.round(computedFullTotal!.totalExVat),
    fallbackSubcontractorTotal: hasSubmittedTotal
      ? Math.round(fields.priceSubcontractor as number)
      : Math.round(computedFullTotal!.subcontractorTotal),
  });
  const finalCustomerTotalExVat = pricingSnapshot.customer.totalExVat;
  const finalSubcontractorTotal = pricingSnapshot.subcontractor.total;

  const now = new Date();
  const deliveryDateObj = fields.deliveryDate ? new Date(fields.deliveryDate) : null;
  if (deliveryDateObj) {
    deliveryDateObj.setHours(23, 59, 59, 999);
  }
  const diffDays = deliveryDateObj
    ? (deliveryDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    : null;
  const effectiveExpressDelivery =
    typeof diffDays === "number" && diffDays <= 1 ? true : fields.expressDelivery;

  const nextOrderNumber = await reserveNextManualOrderNumber(input.companyId);
  const normalizedStatus = fields.status || "processing";

  const order = await prisma.order.create({
    data: {
      companyId: input.companyId,
      createdByMembershipId: input.membershipId,
      lastEditedByMembershipId: null,
      priceListId: input.priceListId,

      customerMembershipId: fields.customerMembershipId,
      customerLabel: fields.customerLabel,
      customerName: fields.customerName,

      legacyWordpressOrderId: null,
      displayId: nextOrderNumber,
      orderNumber: input.orderNumber,

      description: fields.description,
      modelNr: fields.modelNr,

      deliveryDate: fields.deliveryDate,
      timeWindow: fields.timeWindow,
      expressDelivery: effectiveExpressDelivery,
      contactCustomerForCustomTimeWindow: fields.contactCustomerForCustomTimeWindow,
      customTimeContactNote: fields.customTimeContactNote,

      pickupAddress: fields.pickupAddress,
      extraPickupAddress: fields.extraPickups.map((pickup) => pickup.address),
      extraPickupContacts: fields.extraPickups as unknown as Prisma.InputJsonValue,
      deliveryAddress: fields.deliveryAddress,
      returnAddress: fields.returnAddress,
      drivingDistance: fields.drivingDistance,

      phone: fields.phone,
      phoneTwo: fields.phoneTwo,
      email: fields.email,
      customerComments: fields.customerComments,

      floorNo: fields.floorNo,
      lift: fields.lift,

      cashierName: fields.cashierName,
      cashierPhone: fields.cashierPhone,

      subcontractorMembershipId: fields.subcontractorId,
      subcontractor: fields.subcontractor,

      driver: fields.driver,
      secondDriver: fields.secondDriver,
      driverInfo: fields.driverInfo,
      licensePlate: fields.licensePlate,

      deviation: fields.deviation,
      feeExtraWork: fields.feeExtraWork,
      extraWorkMinutes: fields.feeExtraWork ? fields.extraWorkMinutes : 0,
      feeAddToOrder: fields.feeAddToOrder,
      statusNotes: fields.statusNotes,
      status: normalizedStatus,
      dontSendEmail: fields.dontSendEmail,

      priceExVat: Math.round(finalCustomerTotalExVat),
      priceSubcontractor: Math.round(finalSubcontractorTotal),

      rabatt: fields.rabatt,
      dnbDiscount: fields.dnbDiscount,
      leggTil: fields.leggTil,
      subcontractorMinus: fields.subcontractorMinus,
      subcontractorPlus: fields.subcontractorPlus,

      productsSummary: summaries.productsSummary,
      deliveryTypeSummary: summaries.deliveryTypeSummary,
      servicesSummary: summaries.servicesSummary,

      productCardsSnapshot: input.productCards as unknown as Prisma.InputJsonValue,
      pricingSnapshot: pricingSnapshot as unknown as Prisma.InputJsonValue,

      recurringOrderTemplateId: input.recurringOrderTemplateId ?? null,
      recurringOrderOccurrenceDate: input.recurringOrderOccurrenceDate ?? null,
    },
  });

  if (builtItems.length > 0) {
    const MAX_SAFE_CENTS = 2_147_483_647;
    const clampCents = (v: number | null) =>
      v === null || Math.abs(v) > MAX_SAFE_CENTS ? null : v;

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
        customerPriceCents: clampCents(item.customerPriceCents),
        subcontractorPriceCents: clampCents(item.subcontractorPriceCents),
        rawData: item.rawData
          ? (item.rawData as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      })),
    });
  }

  if (input.linkPendingAttachmentsForSessionId) {
    const pending = await prisma.pendingOrderAttachment.findMany({
      where: { sessionId: input.linkPendingAttachmentsForSessionId },
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
      where: { sessionId: input.linkPendingAttachmentsForSessionId },
    });
  }

  await createOrderCreatedEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: {
      membershipId: input.membershipId,
      name: input.actor.name,
      email: input.actor.email,
      source: input.actor.source,
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
      contactCustomerForCustomTimeWindow: order.contactCustomerForCustomTimeWindow,
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
      dnbDiscount: order.dnbDiscount,
      leggTil: order.leggTil,
      subcontractorMinus: order.subcontractorMinus,
      subcontractorPlus: order.subcontractorPlus,
      gsmLastTaskState: order.gsmLastTaskState,
    }),
    createdAt: order.createdAt,
  });

  await createExtraPickupAlert(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    extraPickups: fields.extraPickups,
  });

  await createSubcontractorPriceAlert(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    customerPrice: finalCustomerTotalExVat,
    subcontractorPrice: order.priceSubcontractor,
  });

  await createTodayDeliveryAlert(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    deliveryDate: fields.deliveryDate ?? "",
    timeWindow: order.timeWindow,
  });

  await createNoDeliveryDateAlert(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    deliveryDate: fields.deliveryDate,
  });

  await createContactCustomerAlert(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    contactCustomer: order.contactCustomerForCustomTimeWindow,
    timeWindow: order.timeWindow ?? "",
    note: order.customTimeContactNote ?? "",
  });

  if (fields.deliveryDate && fields.timeWindow) {
    const slotCount = await countOrdersInDeliverySlot(prisma, {
      companyId: order.companyId,
      deliveryDate: fields.deliveryDate,
      timeWindow: fields.timeWindow,
    });

    await createCapacityAlert(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      deliveryDate: fields.deliveryDate,
      timeWindow: fields.timeWindow,
      count: slotCount,
      limit: ORDER_SLOT_LIMIT,
      overCapacity: isDeliverySlotOverCapacity(slotCount, ORDER_SLOT_LIMIT),
    });
  }

  try {
    if (input.companyOrderEmailsEnabled && !order.dontSendEmail) {
      const notificationOrder = {
        id: order.id,
        displayId: order.displayId,
        orderNumber: order.orderNumber,
        customerLabel: fields.customerLabel,
        customerEmail: input.actor.email,
        deliveryDate: fields.deliveryDate,
        pickupAddress: fields.pickupAddress,
        extraPickupAddress: fields.extraPickups.map((pickup) => pickup.address),
        deliveryAddress: fields.deliveryAddress,
        returnAddress: fields.returnAddress,
        drivingDistance: fields.drivingDistance,
        timeWindow: fields.timeWindow,
        expressDelivery: effectiveExpressDelivery,
        description: fields.description,
        customerName: fields.customerName,
        email: fields.email,
        phone: fields.phone,
        floorNo: fields.floorNo,
        lift: fields.lift,
        cashierName: fields.cashierName,
        cashierPhone: fields.cashierPhone,
        status: normalizedStatus,
        createdAt: order.createdAt,
        productsSummary: summaries.productsSummary,
        priceExVat: finalCustomerTotalExVat,
      };

      await sendOrderNotificationEmail({
        kind: "created",
        order: notificationOrder,
        items: builtItems,
      });

      for (const pickup of fields.extraPickups) {
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

  return order;
}
