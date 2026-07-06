import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { PriceListSettings } from "@/lib/products/priceListSettings";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import {
  buildCalculatorBreakdownsWithOrderExtras,
  parseDistanceKm,
  parsePriceSetting,
} from "@/lib/booking/pricing/orderCalculatorExtras";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";

// Server-side equivalent of the totals BookingEditor computes live in the
// browser (productBreakdowns -> order-level extras -> calculateBookingPricing).
// Needed anywhere an Order is created without a live client submitting its
// own computed total (e.g. automatic/recurring orders) — buildOrderItemsFromCards
// only produces per-product-card line items and does not include order-level
// fees (express delivery, extra pickup, deviation, extra work, add-to-order,
// distance charges), so summing OrderItem rows alone under-counts the total.
export function computeFullOrderTotal(params: {
  productCards: SavedProductCard[];
  catalogProducts: CatalogProduct[];
  catalogSpecialOptions: CatalogSpecialOption[];
  priceListSettings: PriceListSettings;
  deviation: string;
  drivingDistance: string;
  expressDelivery: boolean;
  extraWorkMinutes: number;
  feeAddToOrder: boolean;
  feeExtraWork: boolean;
  extraPickups: { address: string }[];
  rabatt: string | null;
  leggTil: string | null;
  subcontractorMinus: string | null;
  subcontractorPlus: string | null;
}): { totalExVat: number; subcontractorTotal: number } {
  // No legacy WordPress import context applies to scheduler orders, so
  // native (non-legacy) distance pricing always applies — matching what
  // BookingEditor resolves for any order without a legacyWordpressOrderId.
  const shouldUseNativeDistancePricing = true;

  const productBreakdowns = buildProductBreakdowns(
    params.productCards,
    params.catalogProducts,
    params.catalogSpecialOptions,
    {
      zeroBaseDeliveryPricesOver100Km:
        shouldUseNativeDistancePricing && parseDistanceKm(params.drivingDistance) > 100,
      xtraPalletPrice: parsePriceSetting(params.priceListSettings.xtraPallet.price),
      xtraPalletSubcontractorPrice: parsePriceSetting(
        params.priceListSettings.xtraPallet.subcontractorPrice,
      ),
    },
  );

  const calculatorBreakdowns = buildCalculatorBreakdownsWithOrderExtras({
    productBreakdowns,
    priceListSettings: params.priceListSettings,
    deviation: params.deviation,
    drivingDistance: params.drivingDistance,
    expressDelivery: params.expressDelivery,
    extraWorkMinutes: params.extraWorkMinutes,
    feeAddToOrder: params.feeAddToOrder,
    feeExtraWork: params.feeExtraWork,
    extraPickups: params.extraPickups,
    shouldUseNativeDistancePricing,
  });

  const priceLookup = buildPriceLookup(params.catalogProducts, params.catalogSpecialOptions);

  const result = calculateBookingPricing({
    productBreakdowns: calculatorBreakdowns,
    priceLookup,
    adjustments: {
      rabatt: params.rabatt ?? "",
      leggTil: params.leggTil ?? "",
      subcontractorMinus: params.subcontractorMinus ?? "",
      subcontractorPlus: params.subcontractorPlus ?? "",
    },
  });

  return {
    totalExVat: result.totals.totalExVat,
    subcontractorTotal: result.totals.subcontractorTotal,
  };
}
