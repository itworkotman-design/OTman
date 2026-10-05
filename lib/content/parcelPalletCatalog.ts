import {
  STANDARD_DELIVERY_TYPES,
  type WhiteGoodsDeliveryTypes,
  type WhiteGoodsOptionSeed,
  type WhiteGoodsProductSeed,
} from "@/lib/content/whiteGoodsElectronics";
import { PARCEL_PALLET_PRICE_LIST_CODE } from "@/lib/content/websitePriceListCodes";

export { PARCEL_PALLET_PRICE_LIST_CODE };

// "Pakke/pall" (Parcel/pallet) — the tree diagram's third Varekategori
// alongside White Goods and Furniture. Every product here is delivery-type
// only (doorstep/carry-in, no install options) — the same shape furniture's
// own delivery-only products (e.g. Mattress) already use, seeded via the
// same seedWebsiteCatalog() as white goods/furniture, which is why this
// plugs into the shared "any other products?" cart directly rather than
// needing a bespoke flow like Moving did.
//
// Prices (NOK ex VAT, rounded to 5 kr when seeded):
// - Pallet: the price codes PALL S1 (774 / 516, one pallet) and PALLXTRA S1
//   (258 / 154.80, each extra pallet) from the white-goods workbook's
//   "Source price codes" sheet. Doorstep only — a pallet is never carried in.
// - Half-pallet: 0.75 × the pallet, doorstep only.
// - Envelope, bag, boxes: a standard item (DELIVERY / INDOOR / XTRA codes).
// - Unpacking: UNPACKING (103.20 / 51.60). Taking the empty pallet: priced
//   like a recycling return, RETURNREC (258 / 154.80).
// seedParcelPalletCatalog.ts passes `preservePricesOnReseed: true`: a reseed
// never resets a price staff entered in /dashboard/booking/editPrices, but
// fills one still at the old 0 kr placeholder.
//
// Not modeled yet: the "extra pallet" quantity surcharge the internal
// dashboard's ProductType.PALLET products get (a flat per-unit rate plus a
// discounted rate for the 2nd+ pallet — see lib/booking/pricing/
// fromProductCards.ts's PALLET branch). These website products are plain
// PHYSICAL products instead — every unit is charged the same flat rate,
// same as any other delivery-only product. Reusing seedWebsiteCatalog (which
// hardcodes productType: "PHYSICAL") was a deliberate scope choice to keep
// this addition small; giving "Pall"/"Halvpall" specifically the real
// PALLET pricing behavior is a follow-up, not a blocker.
const PALLET_FIRST_STEP = { customerPrice: 774, subcontractorPrice: 516, xtraPrice: 258, xtraSubcontractorPrice: 154.8 };
const HALF_PALLET_FIRST_STEP = {
  customerPrice: 580.5,
  subcontractorPrice: 387,
  xtraPrice: 193.5,
  xtraSubcontractorPrice: 116.1,
};

// Doorstep only: carry-in is switched off (its prices just mirror doorstep).
function doorstepOnly(firstStep: WhiteGoodsDeliveryTypes["firstStep"]): WhiteGoodsDeliveryTypes {
  return { firstStep, indoor: firstStep, installOnlyEnabled: false, indoorEnabled: false };
}

// A standard item, like a white-goods delivery — nothing to install.
const PARCEL_DELIVERY: WhiteGoodsDeliveryTypes = { ...STANDARD_DELIVERY_TYPES, installOnlyEnabled: false };

// Code "UNPACKING" is the same one WhiteGoodsProductCard already keys its
// unpacking row off of (product.options.find(o => o.code === "UNPACKING")) —
// reusing it here, rather than a bespoke code, is what makes the row appear
// with no UI changes. Boxes and both pallet sizes only; Bag/Envelope don't
// arrive in packaging worth unpacking.
const UNPACKING_OPTION: WhiteGoodsOptionSeed = {
  code: "UNPACKING",
  category: "extra",
  labelEn: "Unpacking and disposal of packaging",
  labelNo: "Utpakking og kasting av emballasje",
  customerPrice: 103.2,
  subcontractorPrice: 51.6,
};

// Pallet sizes only — offers to take the now-empty pallet away after
// delivery. A plain "extra" (not "return"): that category renders with
// hardcoded white-goods-recycling copy in WhiteGoodsProductCard, which
// wouldn't fit here.
const PALLET_PICKUP_OPTION: WhiteGoodsOptionSeed = {
  code: "PALLET_PICKUP",
  category: "extra",
  labelEn: "Take the empty pallet",
  labelNo: "Ta med tom pall",
  customerPrice: 258,
  subcontractorPrice: 154.8,
};

export const PARCEL_PALLET_PRODUCTS: WhiteGoodsProductSeed[] = [
  {
    code: "PKG_KONVOLUTT",
    nameEn: "Envelope",
    nameNo: "Konvolutt",
    sortOrder: 1,
    deliveryTypes: PARCEL_DELIVERY,
    options: [],
  },
  {
    code: "PKG_POSE",
    nameEn: "Bag",
    nameNo: "Pose",
    sortOrder: 2,
    deliveryTypes: PARCEL_DELIVERY,
    options: [],
    sizeInfo: { maxWeightKg: 15, dimensionsCm: { w: 20, h: 30, d: 40 } },
  },
  {
    code: "PKG_ESKER",
    nameEn: "Boxes",
    nameNo: "Esker",
    sortOrder: 3,
    deliveryTypes: PARCEL_DELIVERY,
    options: [UNPACKING_OPTION],
    sizeInfo: { maxWeightKg: 50, dimensionsCm: { w: 50, h: 50, d: 50 } },
  },
  {
    code: "PKG_HALVPALL",
    nameEn: "Half-pallet",
    nameNo: "Halvpall",
    sortOrder: 4,
    deliveryTypes: doorstepOnly(HALF_PALLET_FIRST_STEP),
    options: [UNPACKING_OPTION, PALLET_PICKUP_OPTION],
    sizeInfo: { maxWeightKg: 100 },
  },
  {
    code: "PKG_PALL",
    nameEn: "Pallet",
    nameNo: "Pall",
    sortOrder: 5,
    deliveryTypes: doorstepOnly(PALLET_FIRST_STEP),
    options: [UNPACKING_OPTION, PALLET_PICKUP_OPTION],
    sizeInfo: { maxWeightKg: 500 },
  },
];
