import { parseDistanceKm } from "@/lib/booking/pricing/orderCalculatorExtras";
import {
  findMovingServiceOptions,
  findMovingSizeOption,
  type MovingCatalog,
  type MovingCatalogOption,
} from "@/lib/content/getMovingCatalog";
import {
  MOVING_CARRY_SURCHARGE_PRODUCT_CODE,
  MOVING_DISTANCE_ITEM_CODE,
  MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
  MOVING_PRODUCT_CODE,
  MOVING_SERVICES_PRODUCT_CODE,
} from "@/lib/content/movingCatalog";
import {
  movingCarrySurchargeLines,
  movingDistanceLines,
  movingFloorSurchargeLines,
  movingOrderPricing,
} from "./movingOrderPricing";
import { movingChargeableFloors, movingPropertyLine, type MovingProperty } from "./movingProperty";

// One move, priced from the moving catalog — shared by the homepage booking
// route (app/api/site/moving-request) and the admin edit
// (app/api/orders/[orderId]/moving-details), so an edited move is priced
// exactly like a booked one. The move is priced on the origin's size; the
// destination's size is information for staff, but must still be real.

export type MovingQuoteInput = {
  origin: MovingProperty;
  destination: MovingProperty;
  serviceCodes: unknown;
  // Pickup → delivery, km as Mapbox returns it ("" when unknown — no km charge).
  drivingDistance: string;
};

export type MovingQuote = {
  ok: true;
  sizeOption: MovingCatalogOption;
  destinationSize: MovingCatalogOption;
  services: MovingCatalogOption[];
  floorSurchargeLines: ReturnType<typeof movingFloorSurchargeLines>;
  carrySurchargeLines: ReturnType<typeof movingCarrySurchargeLines>;
  distanceLines: ReturnType<typeof movingDistanceLines>;
  pricing: ReturnType<typeof movingOrderPricing>;
  // Staff lines for Order.description (movingOrderDescription).
  originLine: string;
  destinationLine: string;
  // Order.productsSummary.
  summary: string;
};

export function priceMovingOrder(
  catalog: MovingCatalog,
  input: MovingQuoteInput,
): MovingQuote | { ok: false; errors: Record<string, string> } {
  const sizeOption = findMovingSizeOption(catalog.options, input.origin.sizeOptionCode);
  const destinationSize = findMovingSizeOption(catalog.options, input.destination.sizeOptionCode);
  if (!sizeOption || !destinationSize) {
    const errors: Record<string, string> = {};
    if (!sizeOption) errors["origin.sizeOptionCode"] = "Unknown size option";
    if (!destinationSize) errors["destination.sizeOptionCode"] = "Unknown size option";
    return { ok: false, errors };
  }
  const services = findMovingServiceOptions(catalog.services, input.serviceCodes);
  if (!services) return { ok: false, errors: { serviceCodes: "Unknown additional service" } };

  const floorSurchargeLines = movingFloorSurchargeLines(catalog.floorSurcharge, [
    { label: "moving from", chargeableFloors: movingChargeableFloors(input.origin) },
    { label: "moving to", chargeableFloors: movingChargeableFloors(input.destination) },
  ]);
  const carrySurchargeLines = movingCarrySurchargeLines(catalog.carrySurcharges ?? [], [
    { label: "moving from", parking: input.origin.parking.code },
    { label: "moving to", parking: input.destination.parking.code },
  ]);
  const distanceLines = movingDistanceLines(catalog.distanceRates ?? null, parseDistanceKm(input.drivingDistance));
  const lines = { sizeOption, services, floorSurchargeLines, carrySurchargeLines, distanceLines };

  return {
    ok: true,
    ...lines,
    destinationSize,
    pricing: movingOrderPricing(
      sizeOption,
      [...services, ...floorSurchargeLines, ...carrySurchargeLines, ...distanceLines],
      movingOrderItemRows(lines),
    ),
    originLine: movingPropertyLine(input.origin, sizeOption.labelEn),
    destinationLine: movingPropertyLine(input.destination, destinationSize.labelEn),
    summary: [
      `Moving (${sizeOption.labelEn})`,
      ...services.map((service) => service.labelEn),
      ...floorSurchargeLines.map((line) => line.labelEn),
      ...carrySurchargeLines.map((line) => line.labelEn),
      ...distanceLines.map((line) => line.labelEn),
    ].join(" + "),
  };
}

// The order's stored lines (Order.items), one per priced line: unit price ×
// quantity (per floor × floors, per km × km). What movingOrderView reads back.
export function movingOrderItemRows(
  quote: Pick<MovingQuote, "sizeOption" | "services" | "floorSurchargeLines" | "carrySurchargeLines" | "distanceLines">,
) {
  const row = (
    productCode: string,
    productName: string,
    line: { code: string; labelEn: string; customerPriceCents: number; subcontractorPriceCents: number },
    quantity = 1,
  ) => ({
    cardId: 0,
    productCode,
    productName,
    itemType: "product",
    optionCode: line.code,
    optionLabel: line.labelEn,
    quantity,
    customerPriceCents: line.customerPriceCents / quantity,
    subcontractorPriceCents: line.subcontractorPriceCents / quantity,
  });
  return [
    row(MOVING_PRODUCT_CODE, "Moving", quote.sizeOption),
    ...quote.services.map((service) => row(MOVING_SERVICES_PRODUCT_CODE, "Additional service", service)),
    ...quote.floorSurchargeLines.map((line) => row(MOVING_FLOOR_SURCHARGE_PRODUCT_CODE, "Floor surcharge", line, line.quantity)),
    ...quote.carrySurchargeLines.map((line) => row(MOVING_CARRY_SURCHARGE_PRODUCT_CODE, "Carrying distance", line, line.quantity)),
    ...quote.distanceLines.map((line) => row(MOVING_DISTANCE_ITEM_CODE, "Driving distance", line, line.quantity)),
  ];
}
