export type PriceOptionKind = "install" | "return" | "delivery" | "extra";

export type PriceOption = {
  id: string;
  productId: string;
  kind: PriceOptionKind;
  priceKey: string;
  active: boolean;
};

// Product-specific installation options
export const PRICE_OPTIONS: PriceOption[] = [
  // ============================================================================
  // WASHING MACHINE
  // ============================================================================
  {
    id: "po_WASH_INSWASH1",
    productId: "WASH",
    kind: "install",
    priceKey: "INSWASH1__montering_vaskemaskin_vatrom",
    active: true,
  },
  {
    id: "po_WASH_INSWASH2",
    productId: "WASH",
    kind: "install",
    priceKey: "INSWASH2__montering_vaskemaskin_ikke_vatrom",
    active: true,
  },
  {
    id: "po_WASH_INSWASH3",
    productId: "WASH",
    kind: "install",
    priceKey: "INSWASH3__Tørketrommel_legges_ovenpå_vaskemaskinen",
    active: true,
  },
  {
    id: "po_WASH_INSWASH4",
    productId: "WASH",
    kind: "install",
    priceKey: "INSWASH4__Omhengsling_av_dør",
    active: true,
  },

  // ============================================================================
  // DISHWASHER
  // ============================================================================
  {
    id: "po_DISH_INSDISHW2",
    productId: "DISH",
    kind: "install",
    priceKey: "INSDISHW2__montering_oppvaskmaskin",
    active: true,
  },
  {
    id: "po_DISH_INSINTDISHW2",
    productId: "DISH",
    kind: "install",
    priceKey: "INSINTDISHW2__montering_oppvaskmaskin_intern",
    active: true,
  },
  {
    id: "po_DISH_INSTALLDOOR",
    productId: "DISH",
    kind: "install",
    priceKey: "INSTALLDOOR__montering_front_int_hvitevare",
    active: true,
  },

  // ============================================================================
  // DRYER
  // ============================================================================
  {
    id: "po_DRYER_INSDRYER",
    productId: "DRYER",
    kind: "install",
    priceKey: "INSDRYER__montering_torketrommel",
    active: true,
  },
  {
    id: "po_DRYER_DRYERONTOP",
    productId: "DRYER",
    kind: "install",
    priceKey: "DRYERONTOP__torketrommel_pa_vaskemaskin",
    active: true,
  },
  {
    id: "po_DRYER_STABLERAMME",
    productId: "DRYER",
    kind: "install",
    priceKey: "STABLERAMME__montering_flatpakket",
    active: true,
  },
  {
    id: "po_DRYER_INSTALLDOOR",
    productId: "DRYER",
    kind: "install",
    priceKey: "STABLERAMME__Omhengsling_av_dør",
    active: true,
  },

  // ============================================================================
  // OVEN
  // ============================================================================
  {
    id: "po_OVEN_INSINTOVEN",
    productId: "OVEN",
    kind: "install",
    priceKey: "INSINTOVEN__montering_int_stekeovn",
    active: true,
  },

  // ============================================================================
  // COOKTOP/HOB
  // ============================================================================
  {
    id: "po_HOB_INSHOB",
    productId: "HOB",
    kind: "install",
    priceKey: "INSHOB__montering_platetopp",
    active: true,
  },
  {
    id: "po_HOB_INSHOB2",
    productId: "HOB",
    kind: "install",
    priceKey: "INSHOB2__montering_platetopp_utklipp",
    active: true,
  },
  {
    id: "po_HOB_INSHOBFAN",
    productId: "HOB",
    kind: "install",
    priceKey: "INSHOBFAN__montering_platetopp_ventilator",
    active: true,
  },
  {
    id: "po_HOB_INSHOBFAN2",
    productId: "HOB",
    kind: "install",
    priceKey: "INSHOBFAN2__montering_platetopp_ventilator_utklipp",
    active: true,
  },

  // ============================================================================
  // COOKER/STOVE
  // ============================================================================
  {
    id: "po_COOKER_INSCOOKER",
    productId: "COOKER",
    kind: "install",
    priceKey: "INSCOOKER__montering_komfyr_kabel",
    active: true,
  },
  {
    id: "po_COOKER_INSCOOKER_STOPSEL",
    productId: "COOKER",
    kind: "install",
    priceKey: "INSCOOKER_STOPSEL__montering_komfyr_inkl_stopsel",
    active: true,
  },
  {
    id: "po_COOKER_STOPSEL",
    productId: "COOKER",
    kind: "install",
    priceKey: "STOPSEL__montering_stopsel",
    active: true,
  },

  // ============================================================================
  // VENTILATOR/HOOD
  // ============================================================================
  {
    id: "po_FAN_INSFAN",
    productId: "FAN",
    kind: "install",
    priceKey: "INSFAN__montering_ventilator",
    active: true,
  },
  {
    id: "po_FAN_INSINTFAN",
    productId: "FAN",
    kind: "install",
    priceKey: "INSINTFAN__montering_integret_ventilator",
    active: true,
  },

  // ============================================================================
  // REFRIGERATOR
  // ============================================================================
  {
    id: "po_FRIDGE_INSFRIDGE",
    productId: "FRIDGE",
    kind: "install",
    priceKey: "INSFRIDGE__montering_frittstaaende_skap",
    active: true,
  },
  {
    id: "po_FRIDGE_INSINTFRIDGE",
    productId: "FRIDGE",
    kind: "install",
    priceKey: "INSINTFRIDGE__montering_int_skap",
    active: true,
  },
  {
    id: "po_FRIDGE_REHANGDOOR2",
    productId: "FRIDGE",
    kind: "install",
    priceKey: "REHANGDOOR2__omhengsling_etter_levering",
    active: true,
  },
  {
    id: "po_FRIDGE_INSTALLDOOR",
    productId: "FRIDGE",
    kind: "install",
    priceKey: "INSTALLDOOR__montering_front_int_hvitevare",
    active: true,
  },

  // ============================================================================
  // FREEZER
  // ============================================================================
  {
    id: "po_FREEZER_INSFRIDGE",
    productId: "FREEZER",
    kind: "install",
    priceKey: "INSFRIDGE__montering_frittstaaende_skap",
    active: true,
  },
  {
    id: "po_FREEZER_INSINTFRIDGE",
    productId: "FREEZER",
    kind: "install",
    priceKey: "INSINTFRIDGE__montering_int_skap",
    active: true,
  },
  
  {
    id: "po_FREEZER_REHANGDOOR2",
    productId: "FREEZER",
    kind: "install",
    priceKey: "REHANGDOOR2__omhengsling_etter_levering",
    active: true,
  },
  {
    id: "po_FREEZER_INSTALLDOOR",
    productId: "FREEZER",
    kind: "install",
    priceKey: "INSTALLDOOR__montering_front_int_hvitevare",
    active: true,
  },

  // ============================================================================
  // MICROWAVE
  // ============================================================================
  {
    id: "po_MICRO_INSINTMICRO",
    productId: "MICRO",
    kind: "install",
    priceKey: "INSINTMICRO__montering_int_mikro",
    active: true,
  },

  // ============================================================================
  // TV
  // ============================================================================
  {
    id: "po_TV_TVTABLE1",
    productId: "TV",
    kind: "install",
    priceKey: "TVTABLE1__montering_tv_under_55_bord",
    active: true,
  },
  {
    id: "po_TV_TVTABLE2",
    productId: "TV",
    kind: "install",
    priceKey: "TVTABLE2__montering_tv_over_55_bord",
    active: true,
  },
  {
    id: "po_TV_ONWALL1",
    productId: "TV",
    kind: "install",
    priceKey: "ONWALL1__montering_tv_under_55_vegg",
    active: true,
  },
  {
    id: "po_TV_ONWALL2",
    productId: "TV",
    kind: "install",
    priceKey: "ONWALL2__montering_tv_over_55_vegg",
    active: true,
  },
  {
    id: "po_TV_TVTABLE3", //???????????????????????????????? NELIEKAS PAREIZI
    productId: "TV",
    kind: "install",
    priceKey: "TVTABLE3__montering_av_75_til_100_vegg",
    active: true,
  },
  {
    id: "po_TV_TVSETUP",
    productId: "TV",
    kind: "install",
    priceKey: "TVSETUP__tv_sett_opp",
    active: true,
  },

  // ============================================================================
  // SIDE BY SIDE
  // ============================================================================
  {
    id: "po_SBS_INSSBS1",
    productId: "SBS",
    kind: "install",
    priceKey: "INSSBS1__montering_sbs_uten_vann",
    active: true,
  },
  {
    id: "po_SBS_INSSBS2",
    productId: "SBS",
    kind: "install",
    priceKey: "INSSBS2__montering_sbs_vanntilkobling",
    active: true,
  },

  // ============================================================================
  // DRYING CABINET
  // ============================================================================
  {
    id: "po_DRYINGCAB_INSFRIDGE",
    productId: "DRYINGCAB",
    kind: "install",
    priceKey: "INSFRIDGE__montering_frittstaaende_skap",
    active: true,
  },
  {
    id: "po_DRYINGCAB_REHANGDOOR2",
    productId: "DRYINGCAB",
    kind: "install",
    priceKey: "REHANGDOOR2__omhengsling_etter_levering",
    active: true,
  },

  // ============================================================================
  // WINE CABINET
  // ============================================================================
  {
    id: "po_WINECAB_INSFRIDGE",
    productId: "WINECAB",
    kind: "install",
    priceKey: "INSFRIDGE__montering_frittstaaende_skap",
    active: true,
  },
 
  {
    id: "po_WINECAB_REHANGDOOR2",
    productId: "WINECAB",
    kind: "install",
    priceKey: "REHANGDOOR2__omhengsling_etter_levering",
    active: true,
  },
  // ============================================================================
  // PALLET
  // ============================================================================
  {
    id: "po_PALLET_PALL_S1",
    productId: "PALLET",
    kind: "install",
    priceKey: "PALL_S1__levering_en_pall",
    active: true,
  },
  {
    id: "po_PALLET_PALLXTRA_S1",
    productId: "PALLET",
    kind: "install",
    priceKey: "PALLXTRA_S1__levering_extra_pall",
    active: true,
  },
  // ============================================================================
  // OTHER
  // ============================================================================
  {
    id: "po_ANDRE",
    productId: "OTHER",
    kind: "install",
    priceKey: "ANDRE__snekker_rorlegger",
    active: true,
  },
  {
    id: "po_OTHER_TIME1",
    productId: "OTHER",
    kind: "install",
    priceKey: "MANN1__timepris_1_mann_bil",
    active: true,
  },
  {
    id: "po_OTHER_TIME2",
    productId: "OTHER",
    kind: "install",
    priceKey: "MANN2__timepris_2_mann_bil",
    active: true,
  },
  // ============================================================================
  // ETTERMONTERING
  // ============================================================================
  {
    id: "po_ETTER",
    productId: "ETTER",
    kind: "install",
    priceKey: "ANDRE__snekker_rorlegger",
    active: true,
  },
  // ============================================================================
  // TIMEPRIS
  // ============================================================================
  {
    id: "po_OTHER_TIME1",
    productId: "TIME",
    kind: "install",
    priceKey: "MANN1__timepris_1_mann_bil",
    active: true,
  },
  {
    id: "po_OTHER_TIME2",
    productId: "TIME",
    kind: "install",
    priceKey: "MANN2__timepris_2_mann_bil",
    active: true,
  },
  {
    id: "po_OTHER_TIME3",
    productId: "TIME",
    kind: "install",
    priceKey: "MANNU1__timepris_1_mann_uten_bil",
    active: true,
  },
  {
    id: "po_OTHER_TIME4",
    productId: "TIME",
    kind: "install",
    priceKey: "MANNU2__timepris_2_mann_uten_bil",
    active: true,
  },
];

// ============================================================================
// GLOBAL OPTIONS (available for ALL products)
// ============================================================================
export const GLOBAL_OPTIONS: PriceOption[] = [
  // Delivery options
  {
    id: "global_delivery",
    productId: "*",
    kind: "delivery",
    priceKey: "DELIVERY__frakt_til_trapp",
    active: true,
  },
  {
    id: "global_indoor",
    productId: "*",
    kind: "delivery",
    priceKey: "INDOOR__hjemlevering_innbaering",
    active: true,
  },
  {
    id: "global_express",
    productId: "*",
    kind: "delivery",
    priceKey: "EXPRESS__tillegg",
    active: true,
  },
  {
    id: "global_pickup",
    productId: "*",
    kind: "delivery",
    priceKey: "PICKUP__hent_andre_butikk",
    active: true,
  },
  {
    id: "global_xtra",
    productId: "*",
    kind: "delivery",
    priceKey: "XTRA__ekstra_kolli",
    active: true,
  },
  
  // Return options
  {
    id: "global_return_store",
    productId: "*",
    kind: "return",
    priceKey: "RETURNSTORE__retur_butikk",
    active: true,
  },
  {
    id: "global_return_recycling",
    productId: "*",
    kind: "return",
    priceKey: "RETURNREC__retur_gjenvinning",
    active: true,
  },
  {
    id: "global_demont",
    productId: "*",
    kind: "return",
    priceKey: "DEMONT__demontering_gamle_vare",
    active: true,
  },
  
  // Extra services
  {
    id: "global_unpacking",
    productId: "*",
    kind: "extra",
    priceKey: "UNPACKING__utpakking_emballasje",
    active: true,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all active options for a specific product
 * Includes both product-specific options AND global options
 */
export function getActiveOptions(productId: string | null) {
  if (!productId) return [];
  
  // Get product-specific options
  const productOptions = PRICE_OPTIONS.filter(
    (o) => o.productId === productId && o.active
  );
  
  // Add global options (available for all products)
  const globalOptions = GLOBAL_OPTIONS.filter((o) => o.active);
  
  return [...productOptions, ...globalOptions];
}

/**
 * Get the full price details for a price option
 */
import { PRICE_ITEMS } from "./pricing";

export function getPriceDetails(priceKey: string) {
  return PRICE_ITEMS.find((item) => item.key === priceKey);
}