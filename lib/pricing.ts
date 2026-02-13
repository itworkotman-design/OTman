export type PriceItem = {
  key: string;          // UNIQUE identifier used in calculations
  code: string;         // logical service code (RETURNSTORE, INSWASH1, etc.)
  label: string;        // human readable
  category: "delivery" | "install" | "return" | "extra";
  customerPrice: number;
  subcontractorPrice: number;
};

/**
 * IMPORTANT RULE:
 *  - `key` must match `priceKey` in PRICE_OPTIONS
 *  - totals are calculated ONLY from this file
 */

export const PRICE_ITEMS: PriceItem[] = [
  // ===== DELIVERY =====
  {
    key: "DELIVERY__first_step",
    code: "DELIVERY",
    label: "First step delivery",
    category: "delivery",
    customerPrice: 0,          // adjust if needed
    subcontractorPrice: 0,
  },

  // ===== WASHING MACHINE INSTALL =====
  {
    key: "INSWASH1__montering_av_vaskemaskin_p_v_trom",
    code: "INSWASH1",
    label: "Washing machine standard installation",
    category: "install",
    customerPrice: 299,
    subcontractorPrice: 249,
  },
  {
    key: "INSINTWASH__montering_av_vaskemaskin_intern",
    code: "INSINTWASH",
    label: "Washing machine internal installation",
    category: "install",
    customerPrice: 309,
    subcontractorPrice: 299,
  },

  // ===== DISHWASHER INSTALL =====
  {
    key: "INSDISHW2__montering_av_oppvaskmaskin",
    code: "INSDISHW2",
    label: "Dishwasher standard installation",
    category: "install",
    customerPrice: 399,
    subcontractorPrice: 299,
  },
  {
    key: "INSINTDISHW2__montering_av_oppvaskmaskin_intern",
    code: "INSINTDISHW2",
    label: "Dishwasher internal installation",
    category: "install",
    customerPrice: 599,
    subcontractorPrice: 399,
  },

  // ===== RETURNS (shared by products) =====
  {
    key: "RETURNSTORE__retur_til_butikk",
    code: "RETURNSTORE",
    label: "Return to store",
    category: "return",
    customerPrice: 300,
    subcontractorPrice: 200,
  },
  {
    key: "RETURNREC__retur_til_gjenvinning",
    code: "RETURNREC",
    label: "Return to recycling",
    category: "return",
    customerPrice: 250,
    subcontractorPrice: 150,
  },
];
