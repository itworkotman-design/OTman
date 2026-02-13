export type PriceOptionKind = "install" | "return" | "extra" | "delivery";

export type PriceOption = {
  id: string;                 // stable id for editing (dashboard)
  productId: string;          // e.g. "WASH"
  productLabel: string;       // display only

  kind: PriceOptionKind;      // NOT shown in table, but needed for logic

  optionLabel: string;        // shown in dashboard + UI
  optionCode: string;         // e.g. "INSWASH1" (stable code)
  description?: string;

  // IMPORTANT: the key from pricing.ts (unique)
  priceKey: string;

  customerPrice: number;
  subcontractorPrice: number;
  active: boolean;
};

export const PRICE_OPTIONS: PriceOption[] = [
  {
    id: "po_WASH_INSWASH1",
    productId: "WASH",
    productLabel: "Washing Machine",
    kind: "install",
    optionLabel: "Standard installation",
    optionCode: "INSWASH1",
    description: "Basic installation",
    priceKey: "INSWASH1__montering_av_vaskemaskin_p_v_trom", // must match pricing.ts item.key
    customerPrice: 299,
    subcontractorPrice: 249,
    active: true,
  },
  {
    id: "po_WASH_INSINTWASH",
    productId: "WASH",
    productLabel: "Washing Machine",
    kind: "install",
    optionLabel: "Internal installation",
    optionCode: "INSINTWASH",
    description: "Internal install",
    priceKey: "INSINTWASH__montering_av_vaskemaskin_intern",
    customerPrice: 309,
    subcontractorPrice: 299,
    active: true,
  },
  {
    id: "po_WASH_RETURNSTORE",
    productId: "WASH",
    productLabel: "Washing Machine",
    kind: "return",
    optionLabel: "Return to store",
    optionCode: "RETURNSTORE",
    description: "",
    priceKey: "RETURNSTORE__retur_til_butikk",
    customerPrice: 300,
    subcontractorPrice: 200,
    active: true,
  },
  {
    id: "po_WASH_RETURNREC",
    productId: "WASH",
    productLabel: "Washing Machine",
    kind: "return",
    optionLabel: "Return to recycling",
    optionCode: "RETURNREC",
    description: "",
    priceKey: "RETURNREC__retur_til_gjenvinning",
    customerPrice: 250,
    subcontractorPrice: 150,
    active: true,
  },

  {
    id: "po_DISH_INSDISHW2",
    productId: "DISH",
    productLabel: "Dishwasher",
    kind: "install",
    optionLabel: "Standard installation",
    optionCode: "INSDISHW2",
    description: "Standard dishwasher install",
    priceKey: "INSDISHW2__montering_av_oppvaskmaskin",
    customerPrice: 399,
    subcontractorPrice: 299,
    active: true,
  },
  {
    id: "po_DISH_INSINTDISHW2",
    productId: "DISH",
    productLabel: "Dishwasher",
    kind: "install",
    optionLabel: "Internal installation",
    optionCode: "INSINTDISHW2",
    description: "Internal dishwasher install",
    priceKey: "INSINTDISHW2__montering_av_oppvaskmaskin_intern",
    customerPrice: 599,
    subcontractorPrice: 399,
    active: true,
  },
  {
    id: "po_DISH_RETURNSTORE",
    productId: "DISH",
    productLabel: "Dishwasher",
    kind: "return",
    optionLabel: "Return to store",
    optionCode: "RETURNSTORE",
    description: "",
    priceKey: "RETURNSTORE__retur_til_butikk",
    customerPrice: 300,
    subcontractorPrice: 200,
    active: true,
  },
  {
    id: "po_DISH_RETURNREC",
    productId: "DISH",
    productLabel: "Dishwasher",
    kind: "return",
    optionLabel: "Return to recycling",
    optionCode: "RETURNREC",
    description: "",
    priceKey: "RETURNREC__retur_til_gjenvinning",
    customerPrice: 250,
    subcontractorPrice: 150,
    active: true,
  },
];
