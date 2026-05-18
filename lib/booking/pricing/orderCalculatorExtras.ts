import { getStartedChargeableKilometers } from "@/lib/booking/pricing/distanceCharges";
import {
  ADD_TO_ORDER_FEE_CODE,
  ADD_TO_ORDER_FEE_LABEL,
  calculateExtraWorkFee,
  EXTRA_WORK_FEE_CODE,
  EXTRA_WORK_FEE_LABEL,
} from "@/lib/booking/pricing/hardcodedFees";
import {
  getDeviationFeeOption,
  type DeviationFeeOption,
} from "@/lib/booking/pricing/deviationFees";
import type { ProductBreakdown } from "@/lib/booking/pricing/types";
import type { PriceListSettings } from "@/lib/products/priceListSettings";

type ExtraPickupInput = {
  address: string;
};

export function parseDistanceKm(value: string) {
  const normalized = value.trim().replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);

  if (!match) {
    return 0;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function parsePriceSetting(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDeviationPriceSetting(
  settings: PriceListSettings,
  deviationFee: DeviationFeeOption,
) {
  const setting = settings.deviations[deviationFee.code];

  return {
    customerPrice: parsePriceSetting(
      setting?.price ?? String(deviationFee.price),
    ),
    subcontractorPrice: parsePriceSetting(
      setting?.subcontractorPrice ?? String(deviationFee.subcontractorPrice),
    ),
  };
}

export function buildCalculatorBreakdownsWithOrderExtras(params: {
  productBreakdowns: ProductBreakdown[];
  priceListSettings: PriceListSettings;
  deviation: string;
  drivingDistance: string;
  expressDelivery: boolean;
  extraWorkMinutes: number;
  feeAddToOrder: boolean;
  feeExtraWork: boolean;
  extraPickups: ExtraPickupInput[];
  shouldUseNativeDistancePricing: boolean;
}) {
  const {
    productBreakdowns,
    priceListSettings,
    deviation,
    drivingDistance,
    expressDelivery,
    extraWorkMinutes,
    feeAddToOrder,
    feeExtraWork,
    extraPickups,
    shouldUseNativeDistancePricing,
  } = params;
  const nextBreakdowns = [...productBreakdowns];
  const extraItems: ProductBreakdown["items"] = [];
  const totalDistanceKm = shouldUseNativeDistancePricing
    ? parseDistanceKm(drivingDistance)
    : 0;
  const chargeableDistanceKm = getStartedChargeableKilometers(totalDistanceKm);
  const kmFrom21Qty =
    totalDistanceKm > 20 && totalDistanceKm <= 100
      ? chargeableDistanceKm
      : 0;
  const kmOver100Qty = totalDistanceKm > 100 ? chargeableDistanceKm : 0;
  const kmFrom21Price = parsePriceSetting(priceListSettings.kmFrom21.price);
  const kmFrom21SubcontractorPrice = parsePriceSetting(
    priceListSettings.kmFrom21.subcontractorPrice,
  );
  const kmOver100Price = parsePriceSetting(priceListSettings.kmOver100.price);
  const kmOver100SubcontractorPrice = parsePriceSetting(
    priceListSettings.kmOver100.subcontractorPrice,
  );
  const extraWorkFee = feeExtraWork
    ? calculateExtraWorkFee(extraWorkMinutes)
    : { blocks: 0, price: 0 };
  const deviationFee = getDeviationFeeOption(deviation);
  const expressDeliveryPrice = parsePriceSetting(
    priceListSettings.expressDelivery.price,
  );
  const expressDeliverySubcontractorPrice = parsePriceSetting(
    priceListSettings.expressDelivery.subcontractorPrice,
  );

  if (expressDelivery && Number.isFinite(expressDeliveryPrice)) {
    extraItems.push({
      kind: "customPrice",
      code: priceListSettings.expressDelivery.code,
      label: priceListSettings.expressDelivery.description,
      qty: 1,
      unitPrice: expressDeliveryPrice,
      subcontractorUnitPrice: expressDeliverySubcontractorPrice,
    });
  }

  const extraPickupCount = extraPickups.filter(
    (pickup) => pickup.address.trim().length > 0,
  ).length;
  const extraPickupPrice = parsePriceSetting(priceListSettings.extraPickup.price);
  const extraPickupSubcontractorPrice = parsePriceSetting(
    priceListSettings.extraPickup.subcontractorPrice,
  );

  if (extraPickupCount > 0 && Number.isFinite(extraPickupPrice)) {
    extraItems.push({
      kind: "customPrice",
      code: priceListSettings.extraPickup.code,
      label: priceListSettings.extraPickup.description,
      qty: extraPickupCount,
      unitPrice: extraPickupPrice,
      subcontractorUnitPrice: extraPickupSubcontractorPrice,
    });
  }

  if (kmFrom21Qty > 0 && Number.isFinite(kmFrom21Price)) {
    extraItems.push({
      kind: "customPrice",
      code: priceListSettings.kmFrom21.code,
      label: priceListSettings.kmFrom21.description,
      qty: kmFrom21Qty,
      unitPrice: kmFrom21Price,
      subcontractorUnitPrice: kmFrom21SubcontractorPrice,
    });
  }

  if (kmOver100Qty > 0 && Number.isFinite(kmOver100Price)) {
    extraItems.push({
      kind: "customPrice",
      code: priceListSettings.kmOver100.code,
      label: priceListSettings.kmOver100.description,
      qty: kmOver100Qty,
      unitPrice: kmOver100Price,
      subcontractorUnitPrice: kmOver100SubcontractorPrice,
    });
  }

  if (deviationFee) {
    const deviationPrices = getDeviationPriceSetting(
      priceListSettings,
      deviationFee,
    );

    extraItems.push({
      kind: "customPrice",
      code: deviationFee.code,
      label: deviationFee.englishLabel,
      qty: 1,
      unitPrice: deviationPrices.customerPrice,
      subcontractorUnitPrice: deviationPrices.subcontractorPrice,
    });
  }

  if (extraWorkFee.price > 0) {
    extraItems.push({
      kind: "customPrice",
      code: EXTRA_WORK_FEE_CODE,
      label: `${EXTRA_WORK_FEE_LABEL} x${extraWorkFee.blocks}`,
      qty: 1,
      unitPrice: extraWorkFee.price,
      subcontractorUnitPrice: 0,
    });
  }

  if (feeAddToOrder) {
    extraItems.push({
      kind: "customPrice",
      code: ADD_TO_ORDER_FEE_CODE,
      label: ADD_TO_ORDER_FEE_LABEL,
      qty: 1,
      unitPrice: 99,
      subcontractorUnitPrice: 0,
    });
  }

  if (extraItems.length > 0) {
    nextBreakdowns.push({
      productName: "Order extras",
      items: extraItems,
    });
  }

  return nextBreakdowns;
}
