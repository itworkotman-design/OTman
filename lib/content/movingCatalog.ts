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
  // NOK ex VAT. Seeded at 0 — a placeholder until a staff member sets real
  // prices via /dashboard/booking/editPrices (Owner/Admin only), same as any
  // newly-added product there. See docs/homepage-ordering-roadmap.md §6/§4
  // progress log for why real figures aren't hardcoded here.
  customerPrice: number;
  subcontractorPrice: number;
};

export const MOVING_SIZE_OPTIONS: MovingSizeOptionSeed[] = [
  { code: "SIZE_UNDER_20", labelEn: "Under 20 m²", labelNo: "Under 20 m²", customerPrice: 0, subcontractorPrice: 0 },
  { code: "SIZE_UNDER_40", labelEn: "Under 40 m²", labelNo: "Under 40 m²", customerPrice: 0, subcontractorPrice: 0 },
  { code: "SIZE_UNDER_60", labelEn: "Under 60 m²", labelNo: "Under 60 m²", customerPrice: 0, subcontractorPrice: 0 },
  { code: "SIZE_UNDER_100", labelEn: "Under 100 m²", labelNo: "Under 100 m²", customerPrice: 0, subcontractorPrice: 0 },
  { code: "SIZE_OVER_100", labelEn: "Over 100 m²", labelNo: "Over 100 m²", customerPrice: 0, subcontractorPrice: 0 },
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
    customerPrice: 0,
    subcontractorPrice: 0,
  },
  {
    code: "SERVICE_FLYTTEVASK",
    labelEn: "Move-out cleaning",
    labelNo: "Flyttevask",
    blurbEn: "A thorough clean of the home you're moving out of.",
    blurbNo: "Grundig vask av boligen du flytter fra.",
    customerPrice: 0,
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
  customerPrice: 0,
  subcontractorPrice: 0,
};
