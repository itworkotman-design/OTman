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

export const PRICE_ITEMS: PriceItem[] = [
  // ============================================================================
  // DELIVERY SERVICES
  // ============================================================================
  {
    key: "EXPRESS__tillegg",
    code: "EXPRESS",
    label: "Express tillegg",
    category: "delivery",
    customerPrice: 625,
    subcontractorPrice: 250,
    active: true,
  },
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
    key: "INSTALL__montering_install",
    code: "INSTALL",
    label: "Montering",
    category: "delivery",
    customerPrice: 590,
    subcontractorPrice: 390,
    active: true,
  },
  {
    key: "INDOOR__hjemlevering_innbaering",
    code: "INDOOR",
    label: "Hjemlevering med innbæring",
    category: "delivery",
    customerPrice: 669,
    subcontractorPrice: 450,
    active: true,
  },
  {
    key: "PALL_S1__levering_en_pall",
    code: "PALL_S1",
    label: "Levering av én pall",
    category: "delivery",
    customerPrice: 750,
    subcontractorPrice: 500,
    active: true,
  },
  {
    key: "PALLXTRA_S1__levering_extra_pall",
    code: "PALLXTRA_S1",
    label: "Levering av extra pall",
    category: "delivery",
    customerPrice: 250,
    subcontractorPrice: 150,
    active: true,
  },
  {
    key: "XTRA__ekstra_kolli",
    code: "XTRA",
    label: "Hjemlevering av mer enn 1 ting - Tillegg ekstra kolli",
    category: "delivery",
    customerPrice: 150,
    subcontractorPrice: 100,
    active: true,
  },
  {
    key: "PICKUP__hent_andre_butikk",
    code: "PICKUP",
    label: "Tillegg hent i andre butikk",
    category: "delivery",
    customerPrice: 590,
    subcontractorPrice: 390,
    active: true,
  },
  {
    key: "ETG_TILLEGG__per_etasje",
    code: "ETG_TILLEGG",
    label: "Tillegg per etg - pris over 2 etg. Uten heis",
    category: "delivery",
    customerPrice: 69,
    subcontractorPrice: 29,
    active: true,
  },
  {
    key: "SIDEBYSIDE__frakt_sbs",
    code: "SIDEBYSIDE",
    label: "Frakt av SBS (indoor inkludert) 2 mann",
    category: "delivery",
    customerPrice: 1300,
    subcontractorPrice: 800,
    active: true,
  },
  {
    key: "SIDEBYSIDETRAPP__levering_sbs_trapp",
    code: "SIDEBYSIDETRAPP",
    label: "Levering av side by side til trapp",
    category: "delivery",
    customerPrice: 999,
    subcontractorPrice: 600,
    active: true,
  },
  {
    key: "SBS_3_MANN__side_by_side_3_mann",
    code: "SBS_3_MANN",
    label: "Side by side 3 mann",
    category: "delivery",
    customerPrice: 2399,
    subcontractorPrice: 1399,
    active: true,
  },
  {
    key: "KM1__kilometer_21km_inkludert",
    code: "KM1",
    label: "21 km inkludert",
    category: "delivery",
    customerPrice: 28,
    subcontractorPrice: 16,
    active: true,
  },
  {
    key: "KM2__kilometer_etter_100km",
    code: "KM2",
    label: "etter 100 km kun km pris uten montering",
    category: "delivery",
    customerPrice: 28,
    subcontractorPrice: 16,
    active: true,
  },

  // ============================================================================
  // RETURN SERVICES
  // ============================================================================
  {
    key: "DEMONT__demontering_gamle_vare",
    code: "DEMONT",
    label: "Demontering gamle vare",
    category: "return",
    customerPrice: 199,
    subcontractorPrice: 99,
    active: true,
  },
  {
    key: "RETURNSBSSTORE__retur_sbs_butikk",
    code: "RETURNSBSSTORE",
    label: "Retur av SBS til butikk",
    category: "return",
    customerPrice: 550,
    subcontractorPrice: 350,
    active: true,
  },
  {
    key: "RETURNSBS__retur_sbs_gjenvinning",
    code: "RETURNSBS",
    label: "Retur av SBS til gjenvinning",
    category: "return",
    customerPrice: 450,
    subcontractorPrice: 250,
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
    key: "RETURNSTORE__retur_butikk",
    code: "RETURNSTORE",
    label: "Tillegg retur til butikk",
    category: "return",
    customerPrice: 300,
    subcontractorPrice: 200,
    active: true,
  },
  {
    key: "UNPACKING__utpakking_emballasje",
    code: "UNPACKING",
    label: "Utpakking og kasting av emballasje",
    category: "extra",
    customerPrice: 100,
    subcontractorPrice: 50,
    active: true,
  },

  // ============================================================================
  // DISHWASHER INSTALLATION
  // ============================================================================
  {
    key: "INSDISHW2__montering_oppvaskmaskin",
    code: "INSDISHW2",
    label: "Montering av oppvaskmaskin på godkjent våtrom",
    category: "install",
    customerPrice: 2249,
    subcontractorPrice: 1000,
    active: true,
  },
  {
    key: "INSINTDISHW2__montering_oppvaskmaskin_intern",
    code: "INSINTDISHW2",
    label: "Montering av intregrert oppvaskmaskin (eks. panel)",
    category: "install",
    customerPrice: 2780,
    subcontractorPrice: 1300,
    active: true,
  },

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
    customerPrice: 9999999,
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
  // DRYER INSTALLATION
  // ============================================================================
  {
    key: "INSDRYER__montering_torketrommel",
    code: "INSDRYER",
    label: "Montering av tørketrommel",
    category: "install",
    customerPrice: 439,
    subcontractorPrice: 200,
    active: true,
  },
  {
    key: "DRYERONTOP__torketrommel_pa_vaskemaskin",
    code: "DRYERONTOP",
    label: "Tørketrommel legges ovenpå vaskemaskinen",
    category: "install",
    customerPrice: 199,
    subcontractorPrice: 100,
    active: true,
  },
  {
    key: "STABLERAMME__montering_flatpakket",
    code: "STABLERAMME",
    label: "Montering av flatpakket stableramme",
    category: "install",
    customerPrice: 490,
    subcontractorPrice: 290,
    active: true,
  },
  {
    key: "STABLERAMME__montering_flatpakket",
    code: "STABLERAMME",
    label: "Montering av flatpakket stableramme",
    category: "install",
    customerPrice: 490,
    subcontractorPrice: 290,
    active: true,
  },
  {
    key: "STABLERAMME__Omhengsling_av_dør",
    code: "REHANGDOOR1",
    label: "Omhengsling av dør",
    category: "install",
    customerPrice: 599,
    subcontractorPrice: 199,
    active: true,
  },

  // ============================================================================
  // OVEN INSTALLATION
  // ============================================================================
  {
    key: "INSINTOVEN__montering_int_stekeovn",
    code: "INSINTOVEN",
    label: "Montering av int. stekeovn",
    category: "install",
    customerPrice: 1199,
    subcontractorPrice: 390,
    active: true,
  },

  // ============================================================================
  // HOB/COOKTOP INSTALLATION
  // ============================================================================
  {
    key: "INSHOB__montering_platetopp",
    code: "INSHOB",
    label: "Montering av platetopp",
    category: "install",
    customerPrice: 999,
    subcontractorPrice: 500,
    active: true,
  },
  {
    key: "INSHOB2__montering_platetopp_utklipp",
    code: "INSHOB2",
    label: "Montering av platetopp med utklipp",
    category: "install",
    customerPrice: 1299,
    subcontractorPrice: 500,
    active: true,
  },
  {
    key: "INSHOBFAN__montering_platetopp_ventilator",
    code: "INSHOBFAN",
    label: "Montering av platetopp med ventilator",
    category: "install",
    customerPrice: 2499,
    subcontractorPrice: 1200,
    active: true,
  },
  {
    key: "INSHOBFAN2__montering_platetopp_ventilator_utklipp",
    code: "INSHOBFAN2",
    label: "Montering av platetopp med ventilator med utklipp",
    category: "install",
    customerPrice: 2799,
    subcontractorPrice: 1200,
    active: true,
  },

  // ============================================================================
  // COOKER/STOVE INSTALLATION
  // ============================================================================
  {
    key: "INSCOOKER__montering_komfyr_kabel",
    code: "INSCOOKER",
    label: "Montering av komfyr (kabel må være på)",
    category: "install",
    customerPrice: 439,
    subcontractorPrice: 230,
    active: true,
  },
  {
    key: "INSCOOKER_STOPSEL__montering_komfyr_inkl_stopsel",
    code: "INSCOOKER",
    label: "Montering av komfyr (Inkl. støpsel)",
    category: "install",
    customerPrice: 499,
    subcontractorPrice: 299,
    active: true,
  },
  {
    key: "STOPSEL__montering_stopsel",
    code: "STOPSEL",
    label: "Montering støpsel til komfyr",
    category: "install",
    customerPrice: 299,
    subcontractorPrice: 150,
    active: true,
  },

  // ============================================================================
  // VENTILATOR/HOOD INSTALLATION
  // ============================================================================
  {
    key: "INSFAN__montering_ventilator",
    code: "INSFAN",
    label: "Montering av ventilator",
    category: "install",
    customerPrice: 1999,
    subcontractorPrice: 799,
    active: true,
  },
  {
    key: "INSINTFAN__montering_integret_ventilator",
    code: "INSINTFAN",
    label: "Montering av integrert ventilator",
    category: "install",
    customerPrice: 1599,
    subcontractorPrice: 799,
    active: true,
  },

  // ============================================================================
  // REFRIGERATOR INSTALLATION
  // ============================================================================
  {
    key: "INSFRIDGE__montering_frittstaaende_skap",
    code: "INSFRIDGE",
    label: "Montering av frittstående skap",
    category: "install",
    customerPrice: 399,
    subcontractorPrice: 199,
    active: true,
  },
  {
    key: "INSINTFRIDGE__montering_int_skap",
    code: "INSINTFRIDGE",
    label: "Montering av int. skap (eks. panel)",
    category: "install",
    customerPrice: 1999,
    subcontractorPrice: 1000,
    active: true,
  },
  {
    key: "REHANGDOOR2__omhengsling_etter_levering",
    code: "REHANGDOOR2",
    label: "Omhengsling av dør etter levering tillegg til INDOOR",
    category: "install",
    customerPrice: 699,
    subcontractorPrice: 399,
    active: true,
  },
  {
    key: "INSTALLDOOR__montering_front_int_hvitevare",
    code: "INSTALLDOOR",
    label: "Montering av front på int. hvitevare",
    category: "install",
    customerPrice: 589,
    subcontractorPrice: 399,
    active: true,
  },

  // ============================================================================
  // MICROWAVE INSTALLATION
  // ============================================================================
  {
    key: "INSINTMICRO__montering_int_mikro",
    code: "INSINTMICRO",
    label: "Montering av int. mikro",
    category: "install",
    customerPrice: 1299,
    subcontractorPrice: 599,
    active: true,
  },

  // ============================================================================
  // TV INSTALLATION
  // ============================================================================
  {
    key: "TVTABLE1__montering_tv_under_55_bord",
    code: "TVTABLE1",
    label: "Montering av Tv under 55\" på bord",
    category: "install",
    customerPrice: 249,
    subcontractorPrice: 149,
    active: true,
  },
  {
    key: "TVTABLE2__montering_tv_over_55_bord",
    code: "TVTABLE2",
    label: "Montering av Tv over 55\" på bord",
    category: "install",
    customerPrice: 499,
    subcontractorPrice: 229,
    active: true,
  },
  {
    key: "TVTABLE3__montering_av_75_til_100_vegg",
    code: "TVTABLE3",
    label: "Montering av Tv fra 75\" til 100\" på vegg",
    category: "install",
    customerPrice: 499,
    subcontractorPrice: 229,
    active: true,
  },
  {
    key: "ONWALL1__montering_tv_under_55_vegg",
    code: "ONWALL1",
    label: "Montering av Tv under 55\" på vegg",
    category: "install",
    customerPrice: 1499,
    subcontractorPrice: 749,
    active: true,
  },
  {
    key: "ONWALL2__montering_tv_over_55_vegg",
    code: "ONWALL2",
    label: "Montering av Tv over 55\" på vegg",
    category: "install",
    customerPrice: 1999,
    subcontractorPrice: 1000,
    active: true,
  },
  {
    key: "TVSETUP__tv_sett_opp",
    code: "TVSETUP",
    label: "TV sett opp",
    category: "install",
    customerPrice: 599,
    subcontractorPrice: 399,
    active: true,
  },

  // ============================================================================
  // SIDE BY SIDE INSTALLATION
  // ============================================================================
  {
    key: "INSSBS2__montering_sbs_vanntilkobling",
    code: "INSSBS2",
    label: "Montering av SBS til godkjent vanntilkobling",
    category: "install",
    customerPrice: 1999,
    subcontractorPrice: 1150,
    active: true,
  },
  {
    key: "INSSBS1__montering_sbs_uten_vann",
    code: "INSSBS1",
    label: "Montering av SBS uten vanntilkobling",
    category: "install",
    customerPrice: 499,
    subcontractorPrice: 249,
    active: true,
  },

  // ============================================================================
  // TIME-BASED SERVICES
  // ============================================================================
  {
    key: "MANN1__timepris_1_mann_bil",
    code: "MANN1",
    label: "1 mann med bil",
    category: "extra",
    customerPrice: 700,
    subcontractorPrice: 550,
    active: true,
  },
  {
    key: "MANN2__timepris_2_mann_bil",
    code: "MANN2",
    label: "2 mann med bil",
    category: "extra",
    customerPrice: 1000,
    subcontractorPrice: 850,
    active: true,
  },
  {
    key: "MANNU1__timepris_1_mann_uten_bil",
    code: "MANNU1",
    label: "1 mann uten bil",
    category: "extra",
    customerPrice: 450,
    subcontractorPrice: 300,
    active: true,
  },
  {
    key: "MANNU2__timepris_2_mann_uten_bil",
    code: "MANNU2",
    label: "2 mann uten bil",
    category: "extra",
    customerPrice: 850,
    subcontractorPrice: 600,
    active: true,
  },
  {
    key: "XTRAARBEID__ekstra_arbeid_20min",
    code: "XTRAARBEID",
    label: "Tillegg for ekstra arbeid per påbegynt 20 min",
    category: "extra",
    customerPrice: 449,
    subcontractorPrice: 299,
    active: true,
  },
  {
    key: "TIMEMONT__timepris_montering",
    code: "TIMEMONT",
    label: "Timepris Montering",
    category: "extra",
    customerPrice: 590,
    subcontractorPrice: 399,
    active: true,
  },
  {
    key: "ANDRE__snekker_rorlegger",
    code: "ANDRE",
    label: "Snekker/ Rørlegger",
    category: "extra",
    customerPrice: 600,
    subcontractorPrice: 999999,
    active: true,
  },

  // ============================================================================
  // DEVIATION/BOMTUR SERVICES
  // ============================================================================
  {
    key: "NOTHOME__bomtur_ikke_hjemme",
    code: "NOTHOME",
    label: "Avvik, bomtur; Kunde ikke hjemme",
    category: "extra",
    customerPrice: 590,
    subcontractorPrice: 390,
    active: true,
  },
  {
    key: "CANCELED__bomtur_avbestilt",
    code: "CANCELED",
    label: "Avvik, bomtur; kunde avbestilt",
    category: "extra",
    customerPrice: 290,
    subcontractorPrice: 149,
    active: true,
  },
  {
    key: "DAMAGESITE__bomtur_vare_skadet",
    code: "DAMAGESITE",
    label: "Avvik, bomtur; vare skadet",
    category: "extra",
    customerPrice: 590,
    subcontractorPrice: 390,
    active: true,
  },
  {
    key: "WRONGPROD_TRAPP__bomtur_feil_vare",
    code: "WRONGPROD_TRAPP",
    label: "Avvik, bomtur levering trapp; Feil vare",
    category: "extra",
    customerPrice: 590,
    subcontractorPrice: 390,
    active: true,
  },
  {
    key: "WRONGADRESS__bomtur_feil_adresse",
    code: "WRONGADRESS",
    label: "Avvik, bomtur; Feil adresse",
    category: "extra",
    customerPrice: 290,
    subcontractorPrice: 149,
    active: true,
  },
  {
    key: "WRONGDATE__bomtur_ny_kjoredato",
    code: "WRONGDATE",
    label: "Avvik, bomtur; Ny kjøredato",
    category: "extra",
    customerPrice: 290,
    subcontractorPrice: 149,
    active: true,
  },
];