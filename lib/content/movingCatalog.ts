import { MOVING_PRICE_LIST_CODE } from "@/lib/content/websitePriceListCodes";

export { MOVING_PRICE_LIST_CODE };

// A move doesn't reduce to "pick a product, pick a delivery type" the way
// white goods/furniture do — it's one flat price per size bracket, no
// delivery type, no install options, no extras. Deliberately its own small
// shape rather than reusing WhiteGoodsProductSeed/seedWebsiteCatalog, which
// are fitted to that other, more complex product structure.
export const MOVING_PRODUCT_CODE = "MOVING_BY_SIZE";

export type MovingSizeOptionSeed = {
  code: string;
  labelEn: string;
  labelNo: string;
  // NOK ex VAT. A starting price only (2026-10, estimated from published
  // Oslo moving/cleaning prices — 2 movers + van ≈ 1 400–1 900 kr/h incl.
  // VAT); staff own the real prices via /dashboard/booking/editPrices. The
  // seed only writes it into a row that's new or still at the old 0 kr
  // placeholder, never over a price staff have set. Subcontractor prices
  // stay 0 — they depend on each partner agreement.
  customerPrice: number;
  subcontractorPrice: number;
};

export const MOVING_SIZE_OPTIONS: MovingSizeOptionSeed[] = [
  { code: "SIZE_UNDER_20", labelEn: "Under 20 m²", labelNo: "Under 20 m²", customerPrice: 3200, subcontractorPrice: 0 },
  { code: "SIZE_UNDER_40", labelEn: "Under 40 m²", labelNo: "Under 40 m²", customerPrice: 5000, subcontractorPrice: 0 },
  { code: "SIZE_UNDER_60", labelEn: "Under 60 m²", labelNo: "Under 60 m²", customerPrice: 7500, subcontractorPrice: 0 },
  { code: "SIZE_UNDER_100", labelEn: "Under 100 m²", labelNo: "Under 100 m²", customerPrice: 12000, subcontractorPrice: 0 },
  { code: "SIZE_UNDER_150", labelEn: "Under 150 m²", labelNo: "Under 150 m²", customerPrice: 17000, subcontractorPrice: 0 },
  { code: "SIZE_OVER_150", labelEn: "Over 150 m²", labelNo: "Over 150 m²", customerPrice: 23000, subcontractorPrice: 0 },
  // SIZE_OVER_100 ("Over 100 m²") was split into the two above (2026-10);
  // a reseed deactivates it, past orders keep pointing at it.
];

// Optional extras on a move, picked on their own step after the size. A
// separate product on the same WEBSITE_MOVING price list so staff price them
// in /dashboard/booking/editPrices next to the sizes; each is one flat price,
// added on top of the size bracket's price.
export const MOVING_SERVICES_PRODUCT_CODE = "MOVING_ADDITIONAL_SERVICES";

export type MovingServiceOptionSeed = MovingSizeOptionSeed & {
  // Short explainer under the tile — site copy, not stored in the DB.
  blurbEn: string;
  blurbNo: string;
};

export const MOVING_SERVICE_OPTIONS: MovingServiceOptionSeed[] = [
  {
    code: "SERVICE_NEDPAKKING",
    labelEn: "Packing",
    labelNo: "Nedpakking",
    blurbEn: "We pack your belongings into boxes before the move.",
    blurbNo: "Vi pakker ned eiendelene dine i esker før flyttingen.",
    customerPrice: 4000,
    subcontractorPrice: 0,
  },
  {
    code: "SERVICE_FLYTTEVASK",
    labelEn: "Move-out cleaning",
    labelNo: "Flyttevask",
    blurbEn: "A thorough clean of the home you're moving out of.",
    blurbNo: "Grundig vask av boligen du flytter fra.",
    customerPrice: 4800,
    subcontractorPrice: 0,
  },
  // Mellomlagring (interim storage) is left out for now — when it comes back
  // it likely needs a duration, not one flat price.
];

// Per-floor surcharge when there's no lift (apartment/office, either end of
// the move) — charged per chargeable floor by the delivery modal's rule
// (movingChargeableFloors). Its own product on the moving price list so staff
// price it in /dashboard/booking/editPrices; a move is far heavier than one
// appliance, so it doesn't reuse the white-goods floor surcharge.
export const MOVING_FLOOR_SURCHARGE_PRODUCT_CODE = "MOVING_FLOOR_SURCHARGE";

export const MOVING_FLOOR_SURCHARGE_OPTION: MovingSizeOptionSeed = {
  code: "FLOOR_SURCHARGE_PER_FLOOR",
  labelEn: "Floor surcharge (per floor, no lift)",
  labelNo: "Etasjetillegg (per etasje, uten heis)",
  customerPrice: 400,
  subcontractorPrice: 0,
};

// The driving-distance (km) charge's order-item code. Not a product: its
// per-km rates are the moving price list's own KM_FROM_21/KM_OVER_100
// settings (getMovingCatalog's distanceRates), priced like delivery's.
export const MOVING_DISTANCE_ITEM_CODE = "MOVING_DISTANCE";

// Carrying-distance surcharge by the parking answer ("Hvor nær kan vi
// parkere?"), charged per end of the move; right outside is free. Codes match
// MOVING_PARKING_OPTIONS' surchargeCode (lib/orders/movingProperty.ts).
export const MOVING_CARRY_SURCHARGE_PRODUCT_CODE = "MOVING_CARRY_SURCHARGE";

export const MOVING_CARRY_SURCHARGE_OPTIONS: MovingSizeOptionSeed[] = [
  {
    code: "CARRY_WITHIN_50M",
    labelEn: "Carrying distance: within 50 m",
    labelNo: "Bæreavstand: innen 50 m",
    customerPrice: 500,
    subcontractorPrice: 0,
  },
  {
    code: "CARRY_FURTHER",
    labelEn: "Carrying distance: further away",
    labelNo: "Bæreavstand: lenger unna",
    customerPrice: 1500,
    subcontractorPrice: 0,
  },
];
