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
  }
];