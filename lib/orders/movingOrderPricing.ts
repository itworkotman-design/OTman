import { getFullChargeableKilometers } from "@/lib/booking/pricing/distanceCharges";
import { websiteInclVat } from "@/lib/booking/pricing/websiteVat";
import { buildOrderPricingSnapshot } from "./orderTotals";
import { MOVING_PARKING_OPTIONS, type MovingParkingCode } from "./movingProperty";

type MovingPricedLine = {
  code: string;
  labelEn: string;
  customerPriceCents: number;
  subcontractorPriceCents: number;
};

// What the customer is shown and pays for a move: the size bracket plus any
// additional services, each line ex. VAT, incl. VAT rounded per line (same
// rule as every website order — lib/booking/pricing/websiteVat.ts). Shared by
// the flow (live total) and movingOrderPricing (stored total), so they can't
// drift apart.
export function movingCustomerTotals(lines: { customerPriceCents: number }[]): {
  totalExVat: number;
  totalIncVat: number;
} {
  const exVat = lines.map((line) => Math.round(line.customerPriceCents / 100));
  return {
    totalExVat: exVat.reduce((sum, amount) => sum + amount, 0),
    totalIncVat: exVat.reduce((sum, amount) => sum + websiteInclVat(amount), 0),
  };
}

// A homepage moving request's price (app/api/site/moving-request). The moving
// price list holds prices ex. VAT, like every website price list; the
// customer pays the size bracket's price plus each additional service's,
// + 25%, rounded to whole kroner per line. The snapshot keeps that total, so
// the payment link charges exactly what the customer was shown
// (getOrderChargeAmountIncVatNok).
export function movingOrderPricing(sizeOption: MovingPricedLine, services: MovingPricedLine[] = []) {
  const lines = [sizeOption, ...services];
  const { totalExVat, totalIncVat } = movingCustomerTotals(lines);
  const priceSubcontractor = lines.reduce((sum, line) => sum + Math.round(line.subcontractorPriceCents / 100), 0);
  return {
    priceExVat: totalExVat,
    priceSubcontractor,
    pricingSnapshot: buildOrderPricingSnapshot({
      lines: [],
      rabatt: null,
      leggTil: null,
      subcontractorMinus: null,
      subcontractorPlus: null,
      fallbackCustomerTotalExVat: totalExVat,
      fallbackSubcontractorTotal: priceSubcontractor,
      customerTotalIncVat: totalIncVat,
    }),
  };
}

// The no-lift floor surcharge as priced lines, one per end of the move that
// has chargeable floors (movingChargeableFloors), each priced per floor — so
// VAT is rounded on the line like every other website line. A missing
// surcharge price (not seeded yet) charges nothing.
export function movingFloorSurchargeLines(
  perFloor: MovingPricedLine | null,
  ends: { label: string; chargeableFloors: number }[],
): (MovingPricedLine & { quantity: number })[] {
  if (!perFloor) return [];
  return ends
    .filter((end) => end.chargeableFloors > 0)
    .map((end) => ({
      code: perFloor.code,
      labelEn: `Floor surcharge, ${end.label} (${end.chargeableFloors} ${end.chargeableFloors === 1 ? "floor" : "floors"})`,
      quantity: end.chargeableFloors,
      customerPriceCents: perFloor.customerPriceCents * end.chargeableFloors,
      subcontractorPriceCents: perFloor.subcontractorPriceCents * end.chargeableFloors,
    }));
}

// The driving-distance charge (pickup → delivery) as a priced line, by the
// same km rule as delivery (getFullChargeableKilometers): free up to 20 km,
// then every started km of the whole distance — at the 21–100 km rate, or the
// over-100 km rate beyond that. Unlike delivery, the size price is kept at any
// distance (it's the moving work itself). A rate of 0 kr charges nothing.
export function movingDistanceLines(
  rates: { kmFrom21: MovingPricedLine; kmOver100: MovingPricedLine } | null,
  distanceKm: number,
): (MovingPricedLine & { quantity: number })[] {
  const km = getFullChargeableKilometers(distanceKm);
  if (!rates || km === 0) return [];
  const rate = distanceKm > 100 ? rates.kmOver100 : rates.kmFrom21;
  if (rate.customerPriceCents === 0 && rate.subcontractorPriceCents === 0) return [];
  return [
    {
      code: rate.code,
      labelEn: `Distance (${km} km)`,
      quantity: km,
      customerPriceCents: rate.customerPriceCents * km,
      subcontractorPriceCents: rate.subcontractorPriceCents * km,
    },
  ];
}

// The carrying-distance surcharge as priced lines, one per end whose parking
// answer has a surcharge (MOVING_PARKING_OPTIONS' surchargeCode — right
// outside is free). A line missing from the price list charges nothing.
export function movingCarrySurchargeLines(
  surcharges: MovingPricedLine[],
  ends: { label: string; parking: MovingParkingCode | null }[],
): (MovingPricedLine & { quantity: number })[] {
  return ends.flatMap((end) => {
    const code = MOVING_PARKING_OPTIONS.find((p) => p.code === end.parking)?.surchargeCode;
    const surcharge = code ? surcharges.find((s) => s.code === code) : undefined;
    if (!surcharge) return [];
    return [
      {
        code: surcharge.code,
        labelEn: `${surcharge.labelEn}, ${end.label}`,
        quantity: 1,
        customerPriceCents: surcharge.customerPriceCents,
        subcontractorPriceCents: surcharge.subcontractorPriceCents,
      },
    ];
  });
}
