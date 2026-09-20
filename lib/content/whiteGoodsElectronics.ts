// Source: "Otman_white_goods_product_options_2026_FINAL(1).xlsx" (sheet "Product options" /
// "Produktvalg (NO)") + "Otman_booking_upper_level_tree_v1_1.xlsx" ("Rules & pricing").
// All prices are NOK, excluding VAT (25%), as given in the source.
//
// Product codes are prefixed WG_ and deliberately distinct from the existing
// seeded "DISHWASHER"/"WASHING_MACHINE" Product rows: Product.deliveryTypes is
// a single column on Product, not scoped per price list, so reusing those rows
// would change delivery-type pricing for the internal dashboard's existing use
// of those products on the DEFAULT/POWER price lists too. This catalog is
// fully separate to keep the website order flow isolated from the internal
// booking flow, per project decision.
//
// Each product's delivery-type base prices (doorstep / carry-in) come from the
// DELIVERY/INDOOR rows. Each install "type" choice is priced at the source's
// *Installation only* number — per the verified identity
// (installOnlyPrice === combinedDeliveryPlusInstallPrice - indoorCarryInBasePrice),
// selecting deliveryType=INDOOR plus that option additively reproduces the source's
// "Delivery + installation" combined price, so only the install-only number needs to
// be stored as the ProductOption price. `combinedWithIndoorInstall` below is carried
// alongside purely so a test can verify that identity against the source numbers,
// catching transcription mistakes — it is not itself persisted anywhere.

export type Money = {
  customerPrice: number;
  subcontractorPrice: number;
};

export type WhiteGoodsDeliveryTypes = {
  firstStep: Money & { xtraPrice: number; xtraSubcontractorPrice: number };
  indoor: Money & { xtraPrice: number; xtraSubcontractorPrice: number };
  /** false only for products with no install option at all (Chest freezer). */
  installOnlyEnabled: boolean;
};

export type WhiteGoodsOptionCategory = "install" | "extra" | "return";

export type WhiteGoodsOptionSeed = Money & {
  code: string;
  category: WhiteGoodsOptionCategory;
  labelEn: string;
  labelNo: string;
  /**
   * Options sharing the same exclusiveGroup are mutually exclusive (radio).
   * Omitted = stackable (checkbox) add-on.
   */
  exclusiveGroup?: string;
  /** Source's "Delivery + installation" combined price, for type-choice options only. */
  combinedWithIndoorInstall?: Money;
};

export type WhiteGoodsProductSeed = {
  code: string;
  nameEn: string;
  nameNo: string;
  sortOrder: number;
  /** Key into the local product icon registry (productIcons.tsx). Optional — falls back to a code-derived key via resolveProductIconKey. */
  iconKey?: string;
  deliveryTypes: WhiteGoodsDeliveryTypes;
  options: WhiteGoodsOptionSeed[];
};

// The "xtra" prices below are what a delivery line is charged on instead
// of its full price when this product isn't the one keeping the full
// price in an order with multiple products (see getAutomaticXtraDeliveryCardIds
// in lib/booking/pricing/sharedDeliveryLogic.ts, shared with the dashboard's
// booking flow — the most-expensive selected delivery across the whole
// order stays at full price; every other product's delivery is charged
// this flat rate instead, regardless of which delivery type it uses).
const STANDARD_DELIVERY_TYPES: WhiteGoodsDeliveryTypes = {
  firstStep: {
    customerPrice: 608.88,
    subcontractorPrice: 402.48,
    xtraPrice: 154.8,
    xtraSubcontractorPrice: 103.2,
  },
  indoor: {
    customerPrice: 690.408,
    subcontractorPrice: 464.4,
    xtraPrice: 236.33,
    xtraSubcontractorPrice: 123.84,
  },
  installOnlyEnabled: true,
};

const STANDARD_UNPACKING: WhiteGoodsOptionSeed = {
  code: "UNPACKING",
  category: "extra",
  labelEn: "Unpacking and disposal of packaging",
  labelNo: "Utpakking og kasting av emballasje",
  customerPrice: 103.2,
  subcontractorPrice: 51.6,
};

const STANDARD_DEMONT: WhiteGoodsOptionSeed = {
  code: "DEMONT",
  category: "extra",
  labelEn: "Dismantling old product",
  labelNo: "Demontering av gammel vare",
  customerPrice: 205.368,
  subcontractorPrice: 102.168,
};

function standardReturn(
  customerPrice = 258,
  subcontractorPrice = 154.8,
): WhiteGoodsOptionSeed {
  return {
    code: "RETURN_RECYCLING",
    category: "return",
    labelEn: "Return old product for recycling",
    labelNo: "Retur av gammel vare til gjenvinning",
    customerPrice,
    subcontractorPrice,
  };
}

function standardAddOns(returnOption: WhiteGoodsOptionSeed = standardReturn()): WhiteGoodsOptionSeed[] {
  return [STANDARD_UNPACKING, STANDARD_DEMONT, returnOption];
}

export const WHITE_GOODS_ELECTRONICS_PRODUCTS: WhiteGoodsProductSeed[] = [
  {
    code: "WG_DISHWASHER",
    nameEn: "Dishwasher",
    nameNo: "Oppvaskmaskin",
    sortOrder: 1,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "DISHWASHER_STANDARD_WETROOM",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Standard / approved wet room",
        labelNo: "Standard / godkjent våtrom",
        customerPrice: 2320.968,
        subcontractorPrice: 1032,
        combinedWithIndoorInstall: { customerPrice: 3011.376, subcontractorPrice: 1496.4 },
      },
      {
        code: "DISHWASHER_INTEGRATED",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Integrated",
        labelNo: "Integrert",
        customerPrice: 2868.96,
        subcontractorPrice: 1341.6,
        combinedWithIndoorInstall: { customerPrice: 3559.368, subcontractorPrice: 1806 },
      },
      {
        code: "DISHWASHER_INTEGRATED_FRONT_PANEL",
        category: "install",
        labelEn: "Install integrated front panel",
        labelNo: "Montering av front på integrert hvitevare",
        customerPrice: 607.848,
        subcontractorPrice: 411.768,
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_WASHING_MACHINE",
    nameEn: "Washing machine",
    nameNo: "Vaskemaskin",
    sortOrder: 2,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "WASHING_MACHINE_APPROVED_WETROOM",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Approved wet room",
        labelNo: "Godkjent våtrom",
        customerPrice: 608.88,
        subcontractorPrice: 402.48,
        combinedWithIndoorInstall: { customerPrice: 1299.288, subcontractorPrice: 866.88 },
      },
      {
        code: "WASHING_MACHINE_NON_APPROVED_WETROOM",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Non-approved wet room",
        labelNo: "Ikke-godkjent våtrom",
        customerPrice: 2569.68,
        subcontractorPrice: 1135.2,
        combinedWithIndoorInstall: { customerPrice: 3260.088, subcontractorPrice: 1599.6 },
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_TUMBLE_DRYER",
    nameEn: "Tumble dryer",
    nameNo: "Tørketrommel",
    sortOrder: 3,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "TUMBLE_DRYER_STANDARD",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Standard",
        labelNo: "Standard",
        customerPrice: 453.048,
        subcontractorPrice: 206.4,
        combinedWithIndoorInstall: { customerPrice: 1143.456, subcontractorPrice: 670.8 },
      },
      {
        code: "TUMBLE_DRYER_STACK_ON_WASHER",
        category: "install",
        labelEn: "Place dryer on top of washing machine",
        labelNo: "Tørketrommel legges ovenpå vaskemaskinen",
        customerPrice: 205.368,
        subcontractorPrice: 103.2,
      },
      {
        code: "TUMBLE_DRYER_STACKING_FRAME",
        category: "install",
        labelEn: "Install flat-packed stacking frame",
        labelNo: "Montering av flatpakket søylesett",
        customerPrice: 505.68,
        subcontractorPrice: 299.28,
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_OVEN",
    nameEn: "Oven",
    nameNo: "Ovn",
    sortOrder: 4,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "OVEN_INTEGRATED",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Integrated oven",
        labelNo: "Integrert ovn",
        customerPrice: 1237.368,
        subcontractorPrice: 402.48,
        combinedWithIndoorInstall: { customerPrice: 1927.776, subcontractorPrice: 866.88 },
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_HOB",
    nameEn: "Hob",
    nameNo: "Platetopp",
    sortOrder: 5,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "HOB_STANDARD",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Standard hob",
        labelNo: "Standard platetopp",
        customerPrice: 1030.968,
        subcontractorPrice: 516,
        combinedWithIndoorInstall: { customerPrice: 1721.376, subcontractorPrice: 980.4 },
      },
      {
        code: "HOB_WITH_EXTRACTOR",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Hob with extractor",
        labelNo: "Platetopp med innebygd vifte",
        customerPrice: 2578.968,
        subcontractorPrice: 1238.4,
        combinedWithIndoorInstall: { customerPrice: 3269.376, subcontractorPrice: 1702.8 },
      },
      {
        code: "HOB_WORKTOP_CUTOUT",
        category: "install",
        labelEn: "Worktop cut-out",
        labelNo: "Utsaging av benkeplate",
        customerPrice: 309.6,
        subcontractorPrice: 206.4,
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_COOKER",
    nameEn: "Cooker",
    nameNo: "Komfyr",
    sortOrder: 6,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "COOKER_CABLE_FITTED",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Cable already fitted",
        labelNo: "Kabel allerede montert",
        customerPrice: 453.048,
        subcontractorPrice: 237.36,
        combinedWithIndoorInstall: { customerPrice: 1143.456, subcontractorPrice: 701.76 },
      },
      {
        code: "COOKER_INCLUDING_PLUG",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Including plug",
        labelNo: "Inkludert støpsel",
        customerPrice: 514.968,
        subcontractorPrice: 308.568,
        combinedWithIndoorInstall: { customerPrice: 1205.376, subcontractorPrice: 772.968 },
      },
      {
        code: "COOKER_INSTALL_PLUG",
        category: "install",
        labelEn: "Install cooker plug",
        labelNo: "Montering av støpsel til komfyr",
        customerPrice: 308.568,
        subcontractorPrice: 154.8,
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_EXTRACTOR_HOOD",
    nameEn: "Extractor hood",
    nameNo: "Ventilator",
    sortOrder: 7,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "EXTRACTOR_HOOD_STANDARD",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Standard",
        labelNo: "Standard",
        customerPrice: 1650.168,
        subcontractorPrice: 824.568,
        combinedWithIndoorInstall: { customerPrice: 2340.576, subcontractorPrice: 1288.968 },
      },
      {
        code: "EXTRACTOR_HOOD_INTEGRATED",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Integrated",
        labelNo: "Integrert",
        customerPrice: 2062.968,
        subcontractorPrice: 1134.168,
        combinedWithIndoorInstall: { customerPrice: 2753.376, subcontractorPrice: 1598.568 },
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_CHEST_FREEZER",
    nameEn: "Chest freezer",
    nameNo: "Fryseboks",
    sortOrder: 8,
    deliveryTypes: {
      ...STANDARD_DELIVERY_TYPES,
      installOnlyEnabled: false,
    },
    // No install type/add-on options at all — delivery-only product.
    options: [...standardAddOns()],
  },
  {
    code: "WG_UPRIGHT_FREEZER",
    nameEn: "Upright freezer",
    nameNo: "Stående fryser",
    sortOrder: 9,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "UPRIGHT_FREEZER_FREESTANDING",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Freestanding",
        labelNo: "Frittstående",
        customerPrice: 411.768,
        subcontractorPrice: 205.368,
        combinedWithIndoorInstall: { customerPrice: 1102.176, subcontractorPrice: 669.768 },
      },
      {
        code: "UPRIGHT_FREEZER_INTEGRATED_FRONT_EXCLUDED",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Integrated (front panel excluded)",
        labelNo: "Integrert (eksklusiv front)",
        customerPrice: 2062.968,
        subcontractorPrice: 1032,
        combinedWithIndoorInstall: { customerPrice: 2753.376, subcontractorPrice: 1496.4 },
      },
      {
        code: "UPRIGHT_FREEZER_REHANG_DOOR_BEFORE",
        category: "install",
        labelEn: "Rehang door before delivery",
        labelNo: "Omhengsling av dør før levering",
        customerPrice: 618.168,
        subcontractorPrice: 308.568,
      },
      {
        code: "UPRIGHT_FREEZER_REHANG_DOOR_AFTER",
        category: "install",
        labelEn: "Rehang door after delivery",
        labelNo: "Omhengsling av dør etter levering",
        customerPrice: 721.368,
        subcontractorPrice: 411.768,
      },
      {
        code: "UPRIGHT_FREEZER_INTEGRATED_FRONT_PANEL",
        category: "install",
        labelEn: "Install integrated front panel",
        labelNo: "Montering av front på integrert hvitevare",
        customerPrice: 607.848,
        subcontractorPrice: 411.768,
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_FRIDGE_FREEZER",
    nameEn: "Fridge / fridge-freezer",
    nameNo: "Kjøleskap / kombiskap",
    sortOrder: 10,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "FRIDGE_FREEZER_FREESTANDING",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Freestanding",
        labelNo: "Frittstående",
        customerPrice: 411.768,
        subcontractorPrice: 205.368,
        combinedWithIndoorInstall: { customerPrice: 1102.176, subcontractorPrice: 669.768 },
      },
      {
        code: "FRIDGE_FREEZER_INTEGRATED_FRONT_EXCLUDED",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Integrated (front panel excluded)",
        labelNo: "Integrert (eksklusiv front)",
        customerPrice: 2062.968,
        subcontractorPrice: 1032,
        combinedWithIndoorInstall: { customerPrice: 2753.376, subcontractorPrice: 1496.4 },
      },
      {
        code: "FRIDGE_FREEZER_REHANG_DOOR_BEFORE",
        category: "install",
        labelEn: "Rehang door before delivery",
        labelNo: "Omhengsling av dør før levering",
        customerPrice: 618.168,
        subcontractorPrice: 308.568,
      },
      {
        code: "FRIDGE_FREEZER_REHANG_DOOR_AFTER",
        category: "install",
        labelEn: "Rehang door after delivery",
        labelNo: "Omhengsling av dør etter levering",
        customerPrice: 721.368,
        subcontractorPrice: 411.768,
      },
      {
        code: "FRIDGE_FREEZER_INTEGRATED_FRONT_PANEL",
        category: "install",
        labelEn: "Install integrated front panel",
        labelNo: "Montering av front på integrert hvitevare",
        customerPrice: 607.848,
        subcontractorPrice: 411.768,
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_MICROWAVE_OVEN",
    nameEn: "Microwave oven",
    nameNo: "Mikrobølgeovn",
    sortOrder: 11,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "MICROWAVE_OVEN_INTEGRATED",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Integrated microwave",
        labelNo: "Integrert mikrobølgeovn",
        customerPrice: 1340.568,
        subcontractorPrice: 618.168,
        combinedWithIndoorInstall: { customerPrice: 2030.976, subcontractorPrice: 1082.568 },
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_WINE_COOLER",
    nameEn: "Wine cooler",
    nameNo: "Vinkjøleskap",
    sortOrder: 12,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "WINE_COOLER_SMALL_INTEGRATED",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Small integrated wine cooler",
        labelNo: "Lite integrert vinkjøleskap",
        customerPrice: 453.048,
        subcontractorPrice: 237.36,
        combinedWithIndoorInstall: { customerPrice: 1143.456, subcontractorPrice: 701.76 },
      },
      {
        code: "WINE_COOLER_LARGE_INTEGRATED",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Large integrated wine cooler",
        labelNo: "Stort integrert vinkjøleskap",
        customerPrice: 2062.968,
        subcontractorPrice: 1032,
        combinedWithIndoorInstall: { customerPrice: 2753.376, subcontractorPrice: 1496.4 },
      },
      {
        code: "WINE_COOLER_INTEGRATED_FRONT_PANEL",
        category: "install",
        labelEn: "Install integrated front panel",
        labelNo: "Montering av front på integrert hvitevare",
        customerPrice: 607.848,
        subcontractorPrice: 411.768,
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_SIDE_BY_SIDE_FRIDGE",
    nameEn: "Side-by-side refrigerator",
    nameNo: "Side-by-side kjøleskap",
    sortOrder: 13,
    // Base delivery prices differ from every other product in this catalog.
    // No source xtra (2nd+ item) price is given for this product — default to
    // the same xtra values used everywhere else (v1 decision, see plan).
    // The source's "carry-in – 3 people" tier is intentionally dropped for v1
    // (doesn't fit the app's fixed 4-key delivery-type model).
    deliveryTypes: {
      firstStep: {
        customerPrice: 1030.968,
        subcontractorPrice: 619.2,
        xtraPrice: 154.8,
        xtraSubcontractorPrice: 103.2,
      },
      indoor: {
        customerPrice: 1341.6,
        subcontractorPrice: 825.6,
        xtraPrice: 236.33,
        xtraSubcontractorPrice: 123.84,
      },
      installOnlyEnabled: true,
    },
    options: [
      {
        code: "SIDE_BY_SIDE_FRIDGE_WITHOUT_WATER",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Without water connection",
        labelNo: "Uten vanntilkobling",
        customerPrice: 514.968,
        subcontractorPrice: 256.968,
        combinedWithIndoorInstall: { customerPrice: 1856.568, subcontractorPrice: 1082.568 },
      },
      {
        code: "SIDE_BY_SIDE_FRIDGE_APPROVED_WATER",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Approved water connection",
        labelNo: "Godkjent vanntilkobling",
        customerPrice: 2062.968,
        subcontractorPrice: 1186.8,
        combinedWithIndoorInstall: { customerPrice: 3404.568, subcontractorPrice: 2012.4 },
      },
      ...standardAddOns(standardReturn(464.4, 258)),
    ],
  },
  {
    code: "WG_TV",
    nameEn: "TV",
    nameNo: "TV",
    sortOrder: 14,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "TV_TABLE_UNDER_55",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Table mount – Under 55\"",
        labelNo: "Bordmontering – Under 55\"",
        customerPrice: 256.968,
        subcontractorPrice: 153.768,
        combinedWithIndoorInstall: { customerPrice: 947.376, subcontractorPrice: 618.168 },
      },
      {
        code: "TV_WALL_UNDER_55",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Wall mount – Under 55\"",
        labelNo: "Veggmontering – Under 55\"",
        customerPrice: 1546.968,
        subcontractorPrice: 772.968,
        combinedWithIndoorInstall: { customerPrice: 2237.376, subcontractorPrice: 1237.368 },
      },
      {
        code: "TV_TABLE_55_74",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Table mount – 55\"–74\"",
        labelNo: "Bordmontering – 55\"–74\"",
        customerPrice: 514.968,
        subcontractorPrice: 236.328,
        combinedWithIndoorInstall: { customerPrice: 1205.376, subcontractorPrice: 700.728 },
      },
      {
        code: "TV_WALL_55_74",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Wall mount – 55\"–74\"",
        labelNo: "Veggmontering – 55\"–74\"",
        customerPrice: 2062.968,
        subcontractorPrice: 1032,
        combinedWithIndoorInstall: { customerPrice: 2753.376, subcontractorPrice: 1496.4 },
      },
      {
        code: "TV_TABLE_75_100",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Table mount – 75\"–100\"",
        labelNo: "Bordmontering – 75\"–100\"",
        customerPrice: 514.968,
        subcontractorPrice: 236.328,
        combinedWithIndoorInstall: { customerPrice: 1205.376, subcontractorPrice: 700.728 },
      },
      {
        code: "TV_WALL_75_100",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Wall mount – 75\"–100\"",
        labelNo: "Veggmontering – 75\"–100\"",
        customerPrice: 2578.968,
        subcontractorPrice: 1288.968,
        combinedWithIndoorInstall: { customerPrice: 3269.376, subcontractorPrice: 1753.368 },
      },
      {
        // Only relevant alongside the 75"-100" mounting types — the UI scopes
        // this add-on's visibility to those two type codes (not encoded in the
        // seed data itself, no schema field for it; see WhiteGoodsProductCard).
        code: "TV_MOUNT_STAND_75_100",
        category: "install",
        labelEn: "Mount on stand / feet – 75\"–100\"",
        labelNo: "Montering på stativ / føtter – 75\"–100\"",
        customerPrice: 1546.968,
        subcontractorPrice: 772.968,
      },
      ...standardAddOns(),
    ],
  },
  {
    code: "WG_DRYING_CABINET",
    nameEn: "Drying cabinet",
    nameNo: "Tørkeskap",
    sortOrder: 15,
    deliveryTypes: STANDARD_DELIVERY_TYPES,
    options: [
      {
        code: "DRYING_CABINET_FREESTANDING",
        category: "install",
        exclusiveGroup: "type",
        labelEn: "Freestanding",
        labelNo: "Frittstående",
        customerPrice: 411.768,
        subcontractorPrice: 205.368,
        combinedWithIndoorInstall: { customerPrice: 1102.176, subcontractorPrice: 669.768 },
      },
      {
        code: "DRYING_CABINET_REHANG_DOOR_BEFORE",
        category: "install",
        labelEn: "Rehang door before delivery",
        labelNo: "Omhengsling av dør før levering",
        customerPrice: 618.168,
        subcontractorPrice: 308.568,
      },
      {
        code: "DRYING_CABINET_REHANG_DOOR_AFTER",
        category: "install",
        labelEn: "Rehang door after delivery",
        labelNo: "Omhengsling av dør etter levering",
        customerPrice: 721.368,
        subcontractorPrice: 411.768,
      },
      ...standardAddOns(),
    ],
  },
];

// Order-level extras (collected once for the whole order, not per product) —
// from the booking tree's "ORDER DETAILS" / "AUTOMATIC PRICING RULES" sections.
export const WHITE_GOODS_ORDER_LEVEL_EXTRAS = {
  extraPickup: { code: "PICKUP", customerPrice: 608.88, subcontractorPrice: 402.48 },
  expressDelivery: { code: "EXPRESS24", customerPrice: 516, subcontractorPrice: 258 },
  // "21 km included ... after 100 km: km price only" — the engine's existing
  // zeroBaseDeliveryPricesOver100Km flag handles the ">100km drops base
  // delivery/install pricing" half of that rule; no distinct >100km per-km
  // rate is given in the source, so kmOver100 reuses the same per-km rate.
  kmFrom21: { code: "KM_FROM_21", customerPrice: 28.896, subcontractorPrice: 16.512 },
  kmOver100: { code: "KM_OVER_100", customerPrice: 28.896, subcontractorPrice: 16.512 },
  floorSurcharge: { code: "FLOOR_SURCHARGE", customerPrice: 71.208, subcontractorPrice: 29.928 },
} as const;
