import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { PriceListSettings } from "@/lib/products/priceListSettings";
import type { CalculatorAdjustments } from "@/lib/booking/pricing/types";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { parseDistanceKm } from "@/lib/booking/pricing/orderCalculatorExtras";
import { applyWebsiteAssemblyExtras, buildWebsiteAssemblyExtraOrderItems } from "@/lib/booking/pricing/websiteAssemblyExtras";
import { applyWebsiteInstallOnlyVisit } from "@/lib/booking/pricing/websiteInstallOnlyVisit";
import { applyWhiteGoodsExtraUnitCharges, buildWhiteGoodsExtraUnitOrderItems } from "@/lib/booking/pricing/whiteGoodsExtraUnits";
import { buildWhiteGoodsCalculatorBreakdowns } from "@/lib/booking/pricing/buildWhiteGoodsCalculatorBreakdowns";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";

// THE price of a homepage website order. The customer's summary
// (WhiteGoodsBookingFlow), order creation (app/api/site/white-goods-order) and
// every re-pricing after it (lib/orders/websiteOrderRepricing.ts) all call this,
// so what the customer is shown is exactly what gets stored and charged.
// Before it existed, each copied the pipeline by hand and they drifted (the
// browser never applied the over-100 km rule).

export type WebsiteOrderPricingInput = {
  cards: SavedProductCard[];
  catalogProducts: CatalogProduct[];
  catalogSpecialOptions: CatalogSpecialOption[];
  priceListSettings: PriceListSettings;
  drivingDistance: string;
  expressDelivery: boolean;
  extraPickups: { address: string }[];
  pickupFloor: number;
  deliveryFloor: number;
  pickupLiftAvailable: boolean;
  deliveryLiftAvailable: boolean;
  extraPickupFloors: { floor: number; liftAvailable: boolean }[];
  // Manual discount/surcharge (admin edits only).
  adjustments?: Partial<CalculatorAdjustments>;
  // A deviation fee (admin, after the fact): a DEVIATION_FEE_OPTIONS label,
  // and for the custom one its own prices and description.
  deviation?: {
    label: string;
    customPrice?: number | null;
    customSubcontractorPrice?: number | null;
    customDescription?: string | null;
  } | null;
  // Line labels' language (the browser); the server keeps the default.
  locale?: "en" | "no";
};

// Over 100 km the per-km charge replaces the base delivery prices.
function zeroBaseDelivery(drivingDistance: string) {
  return parseDistanceKm(drivingDistance) > 100;
}

export function priceWebsiteOrder(input: WebsiteOrderPricingInput) {
  const { cards, catalogProducts, catalogSpecialOptions } = input;
  const productBreakdowns = applyWebsiteInstallOnlyVisit(
    applyWebsiteAssemblyExtras(
      applyWhiteGoodsExtraUnitCharges(
        buildProductBreakdowns(cards, catalogProducts, catalogSpecialOptions, {
          zeroBaseDeliveryPricesOver100Km: zeroBaseDelivery(input.drivingDistance),
          installOnlyVisitPricing: true,
        }),
        cards,
        catalogProducts,
        catalogSpecialOptions,
      ),
      cards,
      catalogProducts,
    ),
    cards,
    catalogProducts,
  );

  const breakdowns = buildWhiteGoodsCalculatorBreakdowns({
    productBreakdowns,
    priceListSettings: input.priceListSettings,
    drivingDistance: input.drivingDistance,
    expressDelivery: input.expressDelivery,
    extraPickups: input.extraPickups,
    pickupFloor: input.pickupFloor,
    deliveryFloor: input.deliveryFloor,
    pickupLiftAvailable: input.pickupLiftAvailable,
    deliveryLiftAvailable: input.deliveryLiftAvailable,
    extraPickupFloors: input.extraPickupFloors,
    deviation: input.deviation?.label ?? "",
    customDeviationPrice: input.deviation?.customPrice ?? null,
    customDeviationSubcontractorPrice: input.deviation?.customSubcontractorPrice ?? null,
    customDeviationDescription: input.deviation?.customDescription ?? null,
  });

  const result = calculateBookingPricing({
    productBreakdowns: breakdowns,
    priceLookup: buildPriceLookup(catalogProducts, catalogSpecialOptions, input.locale ? { locale: input.locale } : undefined),
    adjustments: input.adjustments,
  });

  return {
    result,
    // The order-level lines (floor surcharge, extra pickups, distance…) as the
    // summary shows them — stored on the booking details.
    orderExtras: (result.breakdowns?.find((b) => b.isOrderExtras)?.lines ?? []).map((line) => ({
      label: line.label,
      price: line.lineTotal,
      qty: line.qty,
    })),
  };
}

// The order's stored lines (OrderItem rows / pricingSnapshot.lines), priced
// by the same rules as priceWebsiteOrder so they add up to its total.
export function buildWebsiteOrderItems(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
  options: { drivingDistance: string },
) {
  return [
    ...buildOrderItemsFromCards(cards, catalogProducts, catalogSpecialOptions, {
      installOnlyVisitPricing: true,
      zeroBaseDeliveryPricesOver100Km: zeroBaseDelivery(options.drivingDistance),
    }),
    ...buildWhiteGoodsExtraUnitOrderItems(cards, catalogProducts, catalogSpecialOptions),
    ...buildWebsiteAssemblyExtraOrderItems(cards, catalogProducts),
  ];
}
