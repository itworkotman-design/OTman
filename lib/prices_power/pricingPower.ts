export type PriceCategory = "install" | "return" | "delivery" | "extra";

export type PriceItem = {
  key: string;
  code: string;
  label: string;
  category: PriceCategory;
  customerPrice: number;
  subcontractorPrice: number;
  active: boolean;
};

export const PRICE_ITEMS_POWER: PriceItem[] = [
  // ============================================================================
  // WASHING MACHINE INSTALLATION
  // ============================================================================
  {
    key: "INSWASH2__montering_vaskemaskin_ikke_vatrom",
    code: "INSWASH2",
    label: "Montering av vaskemaskin på ikke-godkjent våtrom",
    category: "install",
    customerPrice: 2490,
    subcontractorPrice: 1100,
    active: true,
  },
  {
    key: "INSWASH1__montering_vaskemaskin_vatrom",
    code: "INSWASH1",
    label: "Montering av vaskemaskin på våtrom",
    category: "install",
    customerPrice: 590,
    subcontractorPrice: 390,
    active: true,
  },
  {
    key: "INSWASH3__Tørketrommel_legges_ovenpå_vaskemaskinen",
    code: "DRYERONTOP",
    label: "Tørketrommel legges ovenpå vaskemaskinen",
    category: "install",
    customerPrice: 199,
    subcontractorPrice: 199,
    active: true,
  },
  {
    key: "INSWASH4__Omhengsling_av_dør",
    code: "REHANGDOOR1",
    label: "Omhengsling av dør",
    category: "install",
    customerPrice: 599,
    subcontractorPrice: 199,
    active: true,
  },
  // ============================================================================
  // DELIVERY
  // ============================================================================
  {
    key: "DELIVERY__frakt_til_trapp",
    code: "DELIVERY",
    label: "Frakt til trapp/dør",
    category: "delivery",
    customerPrice: 590,
    subcontractorPrice: 390,
    active: true,
  },
  {
    key: "INDOOR__hjemlevering_innbaering",
    code: "INDOOR",
    label: "Hjemlevering innbæring",
    category: "delivery",
    customerPrice: 790,
    subcontractorPrice: 490,
    active: true,
  },
  {
    key: "XTRA__ekstra_kolli",
    code: "XTRA",
    label: "Ekstra levering",
    category: "delivery",
    customerPrice: 250,
    subcontractorPrice: 99999,
    active: true,
  },
  {
    key: "PICKUP__hent_andre_butikk",
    code: "PICKUP",
    label: "Hent fra annen butikk",
    category: "delivery",
    customerPrice: 299,
    subcontractorPrice: 199,
    active: true,
  },

  // ============================================================================
  // RETURN
  // ============================================================================
  {
    key: "RETURNSTORE__retur_butikk",
    code: "RETURNSTORE",
    label: "Retur til butikk",
    category: "return",
    customerPrice: 299,
    subcontractorPrice: 199,
    active: true,
  },
  {
    key: "RETURNREC__retur_gjenvinning",
    code: "RETURNREC",
    label: "Tillegg Retur til gjenvinning",
    category: "return",
    customerPrice: 250,
    subcontractorPrice: 150,
    active: true,
  },
  {
    key: "DEMONT__demontering_gamle_vare",
    code: "DEMONT",
    label: "Demontering av gamle varer",
    category: "return",
    customerPrice: 299,
    subcontractorPrice: 199,
    active: true,
  },

  // ============================================================================
  // EXTRA
  // ============================================================================
  {
    key: "UNPACKING__utpakking_emballasje",
    code: "UNPACKING",
    label: "Utpakking og fjerning av emballasje",
    category: "extra",
    customerPrice: 199,
    subcontractorPrice: 99,
    active: true,
  },
];