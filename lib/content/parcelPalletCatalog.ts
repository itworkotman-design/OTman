import type { WhiteGoodsProductSeed } from "@/lib/content/whiteGoodsElectronics";
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
// Prices are placeholders (0 kr) — seeded once via
// seedParcelPalletCatalog.ts, which passes `preservePricesOnReseed: true` so
// a reseed never resets whatever staff have since entered via
// /dashboard/booking/editPrices (unlike furniture/white goods, which DO
// refresh prices from their spreadsheet source on every reseed — there's no
// spreadsheet source here). Same pattern as Moving. See
// docs/homepage-ordering-roadmap.md §5/§4 progress log.
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
const NO_DELIVERY_PRICE = { customerPrice: 0, subcontractorPrice: 0, xtraPrice: 0, xtraSubcontractorPrice: 0 };

export const PARCEL_PALLET_PRODUCTS: WhiteGoodsProductSeed[] = [
  {
    code: "PKG_KONVOLUTT",
    nameEn: "Envelope",
    nameNo: "Konvolutt",
    sortOrder: 1,
    deliveryTypes: { firstStep: NO_DELIVERY_PRICE, indoor: NO_DELIVERY_PRICE, installOnlyEnabled: false },
    options: [],
  },
  {
    code: "PKG_POSE",
    nameEn: "Bag",
    nameNo: "Pose",
    sortOrder: 2,
    deliveryTypes: { firstStep: NO_DELIVERY_PRICE, indoor: NO_DELIVERY_PRICE, installOnlyEnabled: false },
    options: [],
  },
  {
    code: "PKG_ESKER",
    nameEn: "Boxes",
    nameNo: "Esker",
    sortOrder: 3,
    deliveryTypes: { firstStep: NO_DELIVERY_PRICE, indoor: NO_DELIVERY_PRICE, installOnlyEnabled: false },
    options: [],
  },
  {
    code: "PKG_HALVPALL",
    nameEn: "Half-pallet",
    nameNo: "Halvpall",
    sortOrder: 4,
    deliveryTypes: { firstStep: NO_DELIVERY_PRICE, indoor: NO_DELIVERY_PRICE, installOnlyEnabled: false },
    options: [],
  },
  {
    code: "PKG_PALL",
    nameEn: "Pallet",
    nameNo: "Pall",
    sortOrder: 5,
    deliveryTypes: { firstStep: NO_DELIVERY_PRICE, indoor: NO_DELIVERY_PRICE, installOnlyEnabled: false },
    options: [],
  },
];
