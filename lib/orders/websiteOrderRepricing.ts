import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getWebsiteOrderCatalog } from "@/lib/content/websiteOrderCatalog";
import { findCardsWithSizeBracketProblems, findSizePricedCardsMissingName } from "@/lib/booking/pricing/sizeBrackets";
import { applyDimensionDerivedVolumeBrackets } from "@/lib/booking/pricing/sizeDimensions";
import { applyOrderPricingSnapshot } from "@/lib/booking/pricing/snapshot";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import {
  buildOrderPricingSnapshot,
  getPricingSnapshotCustomDeviationDescription,
  getPricingSnapshotCustomDeviationPrice,
  getPricingSnapshotCustomDeviationSubcontractorPrice,
  getPricingSnapshotNulledOrderExtraKeysForCustomer,
  getPricingSnapshotNulledOrderExtraKeysForSubcontractor,
} from "@/lib/orders/orderTotals";
import { buildWebsiteOrderItems, priceWebsiteOrder } from "@/lib/booking/pricing/priceWebsiteOrder";
import { usesFullDistanceKmPricing } from "@/lib/booking/pricing/distanceCharges";
import { normalizePriceListSettings } from "@/lib/products/priceListSettings";
import { floorPricingInputs, parseWhiteGoodsBookingDetails, type OrderExtraLine } from "@/lib/orders/websiteBookingDetails";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// Re-prices an existing website order from a new set of product cards —
// shared by the customer's "Forgot something?" edit link
// (app/api/public/orders/[token]/edit-items) and the admin product editor in
// WebsiteOrderModal (app/api/orders/[orderId]/website-items). Runs the EXACT
// SAME pipeline app/api/site/white-goods-order/route.ts uses to create an
// order, just with the submitted cards, so the recomputed total is consistent
// with how the order was priced originally. Order-level context (driving
// distance, express delivery, floors, lift, extra pickups, manual
// adjustments) is taken from the order as it already exists.

// A size-priced product (Other furniture) must keep exactly one volume and one
// weight bracket — removing one would drop the real size/weight info from the
// order (and, for a waived bracket, change nothing in the price).
export class SizeBracketSelectionError extends Error {}

// ...and it must keep its name (what the item is).
export class ItemNameRequiredError extends Error {}

export type RepricedWebsiteOrder = Awaited<ReturnType<typeof recomputeWebsiteOrderPricing>>;

export async function recomputeWebsiteOrderPricing(
  order: {
    drivingDistance: string | null;
    expressDelivery: boolean;
    floorNo: string | null;
    lift: string | null;
    extraPickupAddress: string[];
    // Per-stop floors and the booked order extras (homepage orders only).
    websiteBookingDetails?: unknown;
    rabatt: string | null;
    leggTil: string | null;
    subcontractorMinus: string | null;
    subcontractorPlus: string | null;
    // A deviation fee set by an admin, and a custom one's own prices.
    deviation?: string | null;
    customDeviation?: { price: number | null; subcontractorPrice: number | null; description: string | null } | null;
    // The order's stored pricing — where a custom deviation's prices live
    // when `customDeviation` isn't given.
    pricingSnapshot?: unknown;
    // Decides the km rule: orders made before FULL_DISTANCE_KM_PRICING_FROM
    // keep the old one, so re-pricing never moves what the customer saw.
    createdAt?: Date | string | null;
    // Order extras set to 0 with the calculator's checkboxes, per side; when
    // not given, the ones stored in the order's pricingSnapshot are kept.
    nulledOrderExtras?: { customer: string[]; subcontractor: string[] };
  },
  rawCards: SavedProductCard[],
  // Admin saves: an admin may save an order that isn't complete yet (e.g. an
  // Other-furniture item without its size), priced with what is there.
  options: { allowIncomplete?: boolean } = {},
) {
  const catalog = await getWebsiteOrderCatalog();
  const customDeviation =
    order.customDeviation !== undefined
      ? order.customDeviation
      : {
          price: getPricingSnapshotCustomDeviationPrice(order.pricingSnapshot),
          subcontractorPrice: getPricingSnapshotCustomDeviationSubcontractorPrice(order.pricingSnapshot),
          description: getPricingSnapshotCustomDeviationDescription(order.pricingSnapshot),
        };

  const nulledOrderExtras = order.nulledOrderExtras ?? {
    customer: getPricingSnapshotNulledOrderExtraKeysForCustomer(order.pricingSnapshot),
    subcontractor: getPricingSnapshotNulledOrderExtraKeysForSubcontractor(order.pricingSnapshot),
  };

  // The volume bracket of a size-priced product is derived from its
  // width/height/length here, never taken from the client.
  const submittedCards = applyDimensionDerivedVolumeBrackets(rawCards, catalog.products);

  if (!options.allowIncomplete && findCardsWithSizeBracketProblems(submittedCards, catalog.products).length > 0) {
    throw new SizeBracketSelectionError();
  }

  if (!options.allowIncomplete && findSizePricedCardsMissingName(submittedCards, catalog.products).length > 0) {
    throw new ItemNameRequiredError();
  }

  // Never trust a per-card frozen pricingSnapshot here — a "Forgot
  // something?" edit should always price against the current live catalog,
  // not whatever was frozen at original booking time.
  const pricingSource = applyOrderPricingSnapshot({
    catalogProducts: catalog.products,
    catalogSpecialOptions: catalog.specialOptions,
    priceListSettings: catalog.priceListSettings,
    pricingSnapshot: null,
  });

  const summaries = buildOrderSummaries(submittedCards, pricingSource.catalogProducts, pricingSource.catalogSpecialOptions);
  const normalizedPriceListSettings = normalizePriceListSettings(catalog.priceListSettings);

  const drivingDistanceStr = order.drivingDistance ?? "";
  // Each stop's own floor/lift from the booking details when the order has
  // them; older orders fall back to the one combined Order.floorNo/lift pair
  // applied to both ends (see floorPricingInputs).
  const floors = floorPricingInputs({
    floorNo: order.floorNo,
    lift: order.lift,
    websiteBookingDetails: order.websiteBookingDetails ?? null,
  });
  const extraPickupsForPricing = (order.extraPickupAddress ?? []).map((address) => ({ address }));

  // The same priceWebsiteOrder the customer's summary and order creation use.
  const { result: pricingResult, orderExtras } = priceWebsiteOrder({
    cards: submittedCards,
    catalogProducts: pricingSource.catalogProducts,
    catalogSpecialOptions: pricingSource.catalogSpecialOptions,
    priceListSettings: normalizedPriceListSettings,
    drivingDistance: drivingDistanceStr,
    expressDelivery: order.expressDelivery === true,
    extraPickups: extraPickupsForPricing,
    pickupFloor: floors.pickupFloor,
    deliveryFloor: floors.deliveryFloor,
    pickupLiftAvailable: floors.pickupLiftAvailable,
    deliveryLiftAvailable: floors.deliveryLiftAvailable,
    extraPickupFloors: floors.extraPickupFloors,
    useFullDistanceKmPricing: usesFullDistanceKmPricing(order.createdAt),
    nulledOrderExtraKeys: nulledOrderExtras,
    deviation: order.deviation
      ? {
          label: order.deviation,
          customPrice: customDeviation?.price ?? null,
          customSubcontractorPrice: customDeviation?.subcontractorPrice ?? null,
          customDescription: customDeviation?.description ?? null,
        }
      : null,
    adjustments: {
      rabatt: order.rabatt ?? "",
      leggTil: order.leggTil ?? "",
      subcontractorMinus: order.subcontractorMinus ?? "",
      subcontractorPlus: order.subcontractorPlus ?? "",
    },
  });
  const builtItems = buildWebsiteOrderItems(submittedCards, pricingSource.catalogProducts, pricingSource.catalogSpecialOptions, {
    drivingDistance: drivingDistanceStr,
  });

  const pricingSnapshot = buildOrderPricingSnapshot({
    lines: builtItems,
    rabatt: order.rabatt,
    leggTil: order.leggTil,
    subcontractorMinus: order.subcontractorMinus,
    subcontractorPlus: order.subcontractorPlus,
    fallbackCustomerTotalExVat: pricingResult.totals.totalExVat,
    fallbackSubcontractorTotal: pricingResult.totals.subcontractorTotal,
    customDeviationPrice: customDeviation?.price ?? null,
    customDeviationSubcontractorPrice: customDeviation?.subcontractorPrice ?? null,
    customDeviationDescription: customDeviation?.description ?? null,
    nulledOrderExtraKeysForCustomer: nulledOrderExtras.customer,
    nulledOrderExtraKeysForSubcontractor: nulledOrderExtras.subcontractor,
  });

  return {
    // The cards with their derived size brackets — what gets persisted.
    cards: submittedCards,
    builtItems,
    summaries,
    pricingSnapshot,
    priceExVat: Math.round(pricingResult.totals.totalExVat),
    priceSubcontractor: Math.round(pricingResult.totals.subcontractorTotal),
    // Same lines the homepage summary shows — kept on the booking details so
    // the admin view stays in step with the new price.
    orderExtras,
    // Every line with its customer and partner price, for the admin calculator.
    pricingResult,
  };
}

// The writes that store a re-priced order: the new cards, snapshot, totals,
// summaries and booking-details extras on the order (plus the caller's own
// `data`), and its order items replaced. For a prisma.$transaction([...]).
export function websiteOrderPricingWrites(
  order: { id: string; websiteBookingDetails: unknown },
  recomputed: RepricedWebsiteOrder,
  data: Prisma.OrderUncheckedUpdateInput,
) {
  return [
    prisma.order.update({
      where: { id: order.id },
      data: {
        productCardsSnapshot: recomputed.cards as unknown as Prisma.InputJsonValue,
        pricingSnapshot: recomputed.pricingSnapshot as unknown as Prisma.InputJsonValue,
        priceExVat: recomputed.priceExVat,
        priceSubcontractor: recomputed.priceSubcontractor,
        ...recomputed.summaries,
        ...refreshedBookingDetails(order.websiteBookingDetails, recomputed.orderExtras),
        ...data,
      },
    }),
    prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
    ...recomputed.builtItems.map((item) =>
      prisma.orderItem.create({
        data: {
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
          rawData: item.rawData as Prisma.InputJsonValue,
        },
      }),
    ),
  ];
}

// The order's booking details with the re-priced order extras, as an
// update fragment — nothing for orders that never had details.
function refreshedBookingDetails(stored: unknown, orderExtras: OrderExtraLine[]) {
  const details = parseWhiteGoodsBookingDetails(stored);
  if (!details) return {};
  // shownTotal was the booking-time price; after a re-price the order is
  // compared against its payments instead (compareOrderWithPayments).
  const next = { ...details, orderExtras };
  delete next.shownTotal;
  return { websiteBookingDetails: next as unknown as Prisma.InputJsonValue };
}
