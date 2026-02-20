export type PriceOptionKind = "install" | "return" | "delivery" | "extra";

export type PriceOption = {
  id: string;
  productId: string;
  kind: PriceOptionKind;
  priceKey: string;
  active: boolean;
};

// Product-specific installation options
export const PRICE_OPTIONS_POWER: PriceOption[] = [
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
  const productOptions = PRICE_OPTIONS_POWER.filter(
    (o) => o.productId === productId && o.active
  );
  
  // Add global options (available for all products)
  const globalOptions = GLOBAL_OPTIONS.filter((o) => o.active);
  
  return [...productOptions, ...globalOptions];
}

/**
 * Get the full price details for a price option
 */
import { PRICE_ITEMS_POWER } from "./pricingPower";

export function getPriceDetails(priceKey: string) {
  return PRICE_ITEMS_POWER.find((item) => item.key === priceKey);
}