import { OPTION_CODES } from "@/lib/booking/constants";
import type { DeliveryType } from "@/lib/booking/pricing/types";

export type WordpressInstallAlias = {
  optionCode: string;
  aliases: string[];
};

export type WordpressProductMapping = {
  catalogAliases: string[];
  wordpressAliases: string[];
  installAliases?: WordpressInstallAlias[];
};

const DEFAULT_INSTALL_ALIASES = [
  "installonly",
  "installdoor",
  "kunmontering",
  "kun installasjon",
  "kun montering",
  "install only",
  "installasjon",
  "montering",
];

export const WORDPRESS_PRODUCT_MAPPINGS: WordpressProductMapping[] = [
  {
    catalogAliases: ["vaskemaskin", "washer", "washing machine"],
    wordpressAliases: ["vaskemaskin", "washer", "washing machine"],
    installAliases: [
      {
        optionCode: "INSWASH1",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "inswash1",
          "install washer",
          "washer install",
          "montering av vaskemaskin pa vatrom",
          "montering av vaskemaskin på våtrom",
          "montering av vaskemaskin",
        ],
      },
      {
        optionCode: "INSWASH2",
        aliases: [
          "inswash2",
          "montering av vaskemaskin pa ikke godkjent vatrom",
          "montering av vaskemaskin på ikke godkjent våtrom",
          "ikke godkjent vatrom",
          "ikke godkjent våtrom",
          "ikke vatrom",
          "ikke våtrom",
        ],
      },
      {
        optionCode: "DRYERONTOP",
        aliases: [
          "dryerontop",
          "torketrommel legges ovenpa vaskemaskinen",
          "tørketrommel legges ovenpå vaskemaskinen",
          "dryer on top",
        ],
      },
      {
        optionCode: "STABLERAMME",
        aliases: [
          "stableramme",
          "montering av flatpakket stableramme",
          "stacking kit",
          "stacking frame",
        ],
      },
    ],
  },
  {
    catalogAliases: ["torketrommel", "tørketrommel", "dryer"],
    wordpressAliases: ["torketrommel", "tørketrommel", "dryer"],
    installAliases: [
      {
        optionCode: "INSDRYER",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "insdryer",
          "install dryer",
          "dryer install",
          "montering av torketrommel",
          "montering av tørketrommel",
        ],
      },
      {
        optionCode: "DRYERONTOP",
        aliases: [
          "dryerontop",
          "torketrommel legges ovenpa vaskemaskinen",
          "tørketrommel legges ovenpå vaskemaskinen",
          "dryer on top",
        ],
      },
      {
        optionCode: "STABLERAMME",
        aliases: [
          "stableramme",
          "montering av flatpakket stableramme",
          "stacking kit",
          "stacking frame",
        ],
      },
    ],
  },
  {
    catalogAliases: ["oppvaskmaskin", "dishwasher"],
    wordpressAliases: ["oppvaskmaskin", "dishwasher"],
    installAliases: [
      {
        optionCode: "INSDISHW2",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "insdishw2",
          "install dishwasher",
          "dishwasher install",
          "montering av oppvaskmaskin",
        ],
      },
    ],
  },
  {
    catalogAliases: [
      "kjoleskap kombiskap",
      "kjøleskap kombiskap",
      "kjoleskap/kombiskap",
      "kjøleskap/kombiskap",
      "kjoleskap",
      "kjøleskap",
      "kombiskap",
      "fridge freezer",
      "fridge",
      "refrigerator",
    ],
    wordpressAliases: [
      "kjoleskap kombiskap",
      "kjøleskap kombiskap",
      "kjoleskap/kombiskap",
      "kjøleskap/kombiskap",
      "kjoleskap",
      "kjøleskap",
      "kombiskap",
      "fridge freezer",
      "fridge",
      "refrigerator",
    ],
    installAliases: [
      {
        optionCode: "INSFRIDGE",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "insfridge",
          "install fridge",
          "fridge install",
          "montering av kjoleskap",
          "montering av kjøleskap",
          "montering av kombiskap",
        ],
      },
      {
        optionCode: "INSINTFRIDGE",
        aliases: [
          "insintfridge",
          "integrert kjoleskap",
          "integrert kjøleskap",
          "integrert kombiskap",
          "integrated fridge",
          "built in fridge",
          "innbygging kjoleskap",
          "innbygging kjøleskap",
        ],
      },
      {
        optionCode: "REHANGDOOR1",
        aliases: [
          "rehangdoor1",
          "omhengsling av dor",
          "omhengsling av dør",
          "rehang door",
        ],
      },
      {
        optionCode: "REHANGDOOR2",
        aliases: [
          "rehangdoor2",
          "omhengsling av dor etter levering tillegg til indoor",
          "omhengsling av dør etter levering tillegg til indoor",
          "re hang door advanced",
        ],
      },
    ],
  },
  {
    catalogAliases: ["fryseskap", "freezer"],
    wordpressAliases: ["fryseskap", "freezer"],
    installAliases: [
      {
        optionCode: "INSFRIDGE",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "insfridge",
          "install freezer",
          "freezer install",
          "montering av fryseskap",
        ],
      },
      {
        optionCode: "INSINTFRIDGE",
        aliases: [
          "insintfridge",
          "integrert fryseskap",
          "integrated freezer",
          "built in freezer",
        ],
      },
    ],
  },
  {
    catalogAliases: ["side by side", "sidebyside", "sbs"],
    wordpressAliases: ["side by side", "sidebyside", "sbs"],
    installAliases: [
      {
        optionCode: "INSSBS1",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "inssbs1",
          "install side by side",
          "side by side install",
          "montering av side by side",
          "montering av sbs uten vanntilkobling",
          "montering av side by side uten vanntilkobling",
        ],
      },
      {
        optionCode: "INSSBS2",
        aliases: [
          "inssbs2",
          "vannkobling side by side",
          "water connection side by side",
          "side by side vann",
          "montering av sbs til godkjent vanntilkobling",
          "montering av side by side til godkjent vanntilkobling",
        ],
      },
    ],
  },
  {
    catalogAliases: ["komfyr", "cooker"],
    wordpressAliases: ["komfyr", "cooker"],
    installAliases: [
      {
        optionCode: "INSCOOKER",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "inscooker",
          "install cooker",
          "cooker install",
          "montering av komfyr",
        ],
      },
      {
        optionCode: "INSCOOKER2",
        aliases: [
          "inscooker2",
          "komfyr spesial",
          "cooker advanced",
          "komfyr med kabel",
        ],
      },
    ],
  },
  {
    catalogAliases: ["ovn", "oven"],
    wordpressAliases: ["ovn", "oven"],
    installAliases: [
      {
        optionCode: "INSINTOVEN",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "insintoven",
          "install oven",
          "oven install",
          "montering av ovn",
        ],
      },
    ],
  },
  {
    catalogAliases: ["platetopp", "cooktop", "hob"],
    wordpressAliases: ["platetopp", "cooktop", "hob"],
    installAliases: [
      {
        optionCode: "INSHOB",
        aliases: ["inshob", "montering av platetopp"],
      },
      {
        optionCode: "INSHOBFAN",
        aliases: ["inshobfan", "montering av platetopp med ventilator"],
      },
      {
        optionCode: "INSHOB2",
        aliases: [
          "inshob2",
          "montering av platetopp med utskjaering",
          "montering av platetopp med utskjaring",
          "montering av platetopp med utskjæring",
        ],
      },
      {
        optionCode: "INSHOBFAN2",
        aliases: [
          "inshobfan2",
          "montering av platetopp med ventilator med utskjaering",
          "montering av platetopp med ventilator med utskjaring",
          "montering av platetopp med ventilator med utskjæring",
        ],
      },
    ],
  },
  {
    catalogAliases: ["ventilator", "fan", "hood", "cooker hood"],
    wordpressAliases: ["ventilator", "fan", "hood", "cooker hood"],
    installAliases: [
      {
        optionCode: "INSFAN",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "insfan",
          "install fan",
          "install hood",
          "montering av ventilator",
        ],
      },
      {
        optionCode: "INSINTFAN",
        aliases: [
          "insintfan",
          "integrert ventilator",
          "integrated fan",
          "integrated hood",
        ],
      },
    ],
  },
  {
    catalogAliases: ["vinskap", "wine cabinet", "wine cooler"],
    wordpressAliases: ["vinskap", "wine cabinet", "wine cooler"],
    installAliases: [
      {
        optionCode: "INSFRIDGE",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "insfridge",
          "install wine cooler",
          "wine cooler install",
          "montering av vinskap",
        ],
      },
      {
        optionCode: "REHANGDOOR2",
        aliases: [
          "rehangdoor2",
          "omhengsling av dor etter levering tillegg til indoor",
          "omhengsling av dør etter levering tillegg til indoor",
        ],
      },
    ],
  },
  {
    catalogAliases: ["andre produkter", "andre produkt", "other products"],
    wordpressAliases: ["andre produkter", "andre produkt", "other products"],
  },
  {
    catalogAliases: ["ettermontering", "etter montering", "after install"],
    wordpressAliases: ["ettermontering", "etter montering", "after install"],
  },
  {
    catalogAliases: ["kasse", "box"],
    wordpressAliases: ["kasse", "box"],
  },
  {
    catalogAliases: ["pall", "pallet"],
    wordpressAliases: ["pall", "pallet"],
  },
  {
    catalogAliases: ["tv", "television"],
    wordpressAliases: ["tv", "television"],
  },
  {
    catalogAliases: ["mikrobolgeovn", "mikrobølgeovn", "microwave"],
    wordpressAliases: ["mikrobolgeovn", "mikrobølgeovn", "microwave"],
  },
  {
    catalogAliases: ["timepris", "timepris flugger", "hourly", "hourly rate"],
    wordpressAliases: [
      "timepris",
      "timepris flugger",
      "timepris_flugger",
      "hourly",
      "hourly rate",
    ],
  },
];

export const WORDPRESS_DELIVERY_TYPE_ALIASES: Record<DeliveryType, string[]> = {
  "": [],
  FIRST_STEP: ["delivery", "forste trinn", "første trinn", "first step"],
  INDOOR: [
    "indoor",
    "indoor carry",
    "innbaering",
    "innbæring",
    "carry in",
    "sidbyside",
    "sidebyside",
    "side by side",
    "sidetrapp",
    "side by side trapp",
  ],
  INSTALL_ONLY: [
    "installonly",
    "kun installasjon",
    "kun montering",
    "install only",
    "kun installasjon montering",
    "kun installasjon/montering",
    "kunmontering",
  ],
  RETURN_ONLY: ["returnonly", "kun retur", "return only"],
};

export const WORDPRESS_SPECIAL_SERVICE_ALIASES: Record<string, string[]> = {
  [OPTION_CODES.DEMONT]: ["demontering", "demontering gamle vare", "demont"],
  [OPTION_CODES.UNPACKING]: [
    "utpakking",
    "utpakking og kasting av emballasje",
    "unpacking",
  ],
  RETURNSTORE: [
    "retur til butikk",
    "tillegg retur til butikk",
    "return to store",
  ],
  RETURNREC: [
    "retur til gjenvinning",
    "tillegg retur til gjenvinning",
    "return recycling",
  ],
};

export const WORDPRESS_SERVICE_CODE_ALIASES: Record<string, string[]> = {
  RETURNSBSSTORE: ["RETURNSBSSTORE", "RETURNSTORE", "SBSRETURN"],
  RETURNSBS: ["RETURNSBS", "RETURNREC"],

  INSSBS1: ["INSSBS1"],
  INSSBS2: ["INSSBS2"],

  INSHOB: ["INSHOB"],
  INSHOBFAN: ["INSHOBFAN"],
  INSHOB2: ["INSHOB2"],
  INSHOBFAN2: ["INSHOBFAN2"],

  INSWASH1: ["INSWASH1"],
  INSWASH2: ["INSWASH2"],
  DRYERONTOP: ["DRYERONTOP"],
  STABLERAMME: ["STABLERAMME"],

  REHANGDOOR1: ["REHANGDOOR1"],
  REHANGDOOR2: ["REHANGDOOR2"],

  MANNU1: ["MANNU1", "1 mann uten bil"],
  MANNU2: ["MANNU2", "2 mann uten bil"],
  MANN1: ["MANN1", "1 mann med varebil"],
  MANN2: ["MANN2", "2 mann med varebil"],
  ANDRE: [
    "ANDRE",
    "snekker rorlegger",
    "snekker/rørlegger",
    "snekker/rorlegger",
    "timearbeid",
  ],

  PALLS1: ["PALLS1"],
  PALLXTRAS1: ["PALLXTRAS1"],

  RETURNREC: ["RETURNREC"],
  RETURNSTORE: ["RETURNSTORE"],
};
