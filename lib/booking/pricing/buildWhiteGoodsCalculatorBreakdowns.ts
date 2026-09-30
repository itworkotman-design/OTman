import {
  buildCalculatorBreakdownsWithOrderExtras,
  parsePriceSetting,
} from "@/lib/booking/pricing/orderCalculatorExtras";
import type { ProductBreakdown } from "@/lib/booking/pricing/types";
import type { PriceListSettings } from "@/lib/products/priceListSettings";

/**
 * Chargeable floors above the included 2nd floor, with no lift. Matches the
 * source rule: "Floor surcharge over 2nd floor, no lift ... per chargeable
 * floor above the included level."
 */
export function getChargeableFloors(floor: number, liftAvailable: boolean): number {
  if (liftAvailable) return 0;
  if (!Number.isFinite(floor) || floor <= 2) return 0;

  return Math.floor(floor) - 2;
}

type WhiteGoodsCalculatorExtrasParams = {
  productBreakdowns: ProductBreakdown[];
  priceListSettings: PriceListSettings;
  drivingDistance: string;
  expressDelivery: boolean;
  extraPickups: Array<{ address: string }>;
  pickupFloor: number;
  deliveryFloor: number;
  // Tracked separately: a lift at the pickup location says nothing about
  // whether the delivery address has one, and vice versa.
  pickupLiftAvailable: boolean;
  deliveryLiftAvailable: boolean;
  shouldUseNativeDistancePricing?: boolean;
};

/**
 * Wraps the shared order-extras calculator (express delivery, extra pickup,
 * distance) — unmodified — and appends a floor-surcharge line item on top.
 * Kept as a wrapper rather than a change to the shared file so the internal
 * dashboard booking flow, which has no concept of a floor surcharge, is
 * completely unaffected. Dashboard-only concepts the website flow never
 * exposes (deviation fees, extra work minutes, "add to order" fee) are
 * passed through as neutral no-ops.
 */
export function buildWhiteGoodsCalculatorBreakdowns(
  params: WhiteGoodsCalculatorExtrasParams,
): ProductBreakdown[] {
  const { pickupFloor, deliveryFloor, pickupLiftAvailable, deliveryLiftAvailable, ...sharedParams } = params;

  const breakdowns = buildCalculatorBreakdownsWithOrderExtras({
    ...sharedParams,
    deviation: "",
    extraWorkMinutes: 0,
    feeAddToOrder: false,
    feeExtraWork: false,
    shouldUseNativeDistancePricing: sharedParams.shouldUseNativeDistancePricing ?? true,
  });

  const chargeableFloors =
    getChargeableFloors(pickupFloor, pickupLiftAvailable) +
    getChargeableFloors(deliveryFloor, deliveryLiftAvailable);

  if (chargeableFloors <= 0) {
    return breakdowns;
  }

  const floorSurcharge = params.priceListSettings.floorSurcharge;
  const unitPrice = parsePriceSetting(floorSurcharge.price);
  const subcontractorUnitPrice = parsePriceSetting(floorSurcharge.subcontractorPrice);

  const floorItem: ProductBreakdown["items"][number] = {
    kind: "customPrice",
    code: floorSurcharge.code,
    label: floorSurcharge.description,
    qty: chargeableFloors,
    unitPrice,
    subcontractorUnitPrice,
  };

  const existingExtras = breakdowns.find((b) => b.isOrderExtras);

  if (existingExtras) {
    return breakdowns.map((b) =>
      b === existingExtras ? { ...b, items: [...b.items, floorItem] } : b,
    );
  }

  return [
    ...breakdowns,
    { productName: "Order extras", items: [floorItem], isOrderExtras: true },
  ];
}
