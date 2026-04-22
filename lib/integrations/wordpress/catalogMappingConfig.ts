import { DELIVERY_TYPES, OPTION_CODES } from "@/lib/booking/constants";
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
          "install washer",
          "washer install",
          "montering av vaskemaskin pa vatrom",
          "montering av vaskemaskin",
        ],
      },
      {
        optionCode: "INSWASH2",
        aliases: [
          "montering av vaskemaskin pa ikke godkjent vatrom",
          "ikke godkjent vatrom",
          "ikke vatrom",
        ],
      },
      {
        optionCode: "DRYERONTOP",
        aliases: [
          "dryerontop",
          "torketrommel legges ovenpa vaskemaskinen",
          "dryer on top",
        ],
      },
      {
        optionCode: "STABLERAMME",
        aliases: ["stableramme", "stacking kit", "stacking frame"],
      },
    ],
  },
  {
    catalogAliases: ["torketrommel", "dryer"],
    wordpressAliases: ["torketrommel", "dryer"],
    installAliases: [
      {
        optionCode: "INSDRYER",
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "install dryer",
          "dryer install",
          "montering av torketrommel",
        ],
      },
      {
        optionCode: "DRYERONTOP",
        aliases: [
          "dryerontop",
          "torketrommel legges ovenpa vaskemaskinen",
          "dryer on top",
        ],
      },
      {
        optionCode: "STABLERAMME",
        aliases: ["stableramme", "stacking kit", "stacking frame"],
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
      "kjoleskap/kombiskap",
      "kjoleskap",
      "kombiskap",
      "fridge freezer",
      "fridge",
      "refrigerator",
    ],
    wordpressAliases: [
      "kjoleskap kombiskap",
      "kjoleskap/kombiskap",
      "kjoleskap",
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
          "install fridge",
          "fridge install",
          "montering av kjoleskap",
          "montering av kombiskap",
        ],
      },
      {
        optionCode: "INSINTFRIDGE",
        aliases: [
          "integrert kjoleskap",
          "integrert kombiskap",
          "integrated fridge",
          "built in fridge",
          "innbygging kjoleskap",
        ],
      },
      {
        optionCode: "REHANGDOOR1",
        aliases: ["rehangdoor1", "omhengsling av dor", "rehang door"],
      },
      {
        optionCode: "REHANGDOOR2",
        aliases: ["rehangdoor2", "ombeygging dor", "re hang door advanced"],
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
          "install freezer",
          "freezer install",
          "montering av fryseskap",
        ],
      },
      {
        optionCode: "INSINTFRIDGE",
        aliases: [
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
          "install side by side",
          "side by side install",
          "montering av side by side",
        ],
      },
      {
        optionCode: "INSSBS2",
        aliases: [
          "vannkobling side by side",
          "water connection side by side",
          "side by side vann",
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
          "install cooker",
          "cooker install",
          "montering av komfyr",
        ],
      },
      {
        optionCode: "INSCOOKER2",
        aliases: [
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
        aliases: [
          ...DEFAULT_INSTALL_ALIASES,
          "install hob",
          "install cooktop",
          "montering av platetopp",
        ],
      },
      {
        optionCode: "INSHOB2",
        aliases: ["platetopp spesial", "hob advanced", "cooktop advanced"],
      },
      {
        optionCode: "INSHOBFAN",
        aliases: [
          "platetopp med ventilator",
          "hob with fan",
          "cooktop with fan",
        ],
      },
      {
        optionCode: "INSHOBFAN2",
        aliases: [
          "platetopp med ventilator spesial",
          "hob with fan advanced",
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
          "install fan",
          "install hood",
          "montering av ventilator",
        ],
      },
      {
        optionCode: "INSINTFAN",
        aliases: [
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
          "install wine cooler",
          "wine cooler install",
          "montering av vinskap",
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
    catalogAliases: ["mikrobolgeovn", "microwave"],
    wordpressAliases: ["mikrobolgeovn", "microwave"],
  },
  {
    catalogAliases: ["timepris", "hourly", "hourly rate"],
    wordpressAliases: ["timepris", "hourly", "hourly rate"],
  },
];

export const WORDPRESS_DELIVERY_TYPE_ALIASES: Record<DeliveryType, string[]> = {
  "": [],
  FIRST_STEP: [
    "delivery",
    "forste trinn",
    "first step",
    "sidebyside",
    "side by side",
    "sidetrapp",
  ],
  INDOOR: ["indoor", "indoor carry", "innbaering", "carry in"],
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
  RETURNSTORE: ["retur til butikk", "tillegg retur til butikk", "return to store"],
  RETURNREC: [
    "retur til gjenvinning",
    "tillegg retur til gjenvinning",
    "return recycling",
  ],
};
