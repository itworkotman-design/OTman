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
