export type DeviationFeeOption = {
  code: string;
  englishLabel: string;
  norwegianLabel: string;
  price: number;
};

export const DEVIATION_FEE_OPTIONS: DeviationFeeOption[] = [
  {
    code: "NOTHOME",
    englishLabel: "Deviation, missed trip; Customer not at home",
    norwegianLabel: "Avvik, bomtur; Kunde ikke hjemme",
    price: 590,
  },
  {
    code: "CANCELED",
    englishLabel: "Deviation, dead end; Customer cancelled",
    norwegianLabel: "Avvik, bomtur; kunde avbestilt",
    price: 590,
  },
  {
    code: "DAMAGESITE",
    englishLabel: "Deviation, missed delivery; Damaged goods",
    norwegianLabel: "Avvik, bomtur; vare skadet",
    price: 590,
  },
  {
    code: "WRONGPROD",
    englishLabel: "Deviation, delivery toll stairs; Wrong item",
    norwegianLabel: "Avvik, bomtur levering trapp; Feil vare",
    price: 590,
  },
  {
    code: "WRONGADRESS",
    englishLabel: "Deviation, toll; Wrong address",
    norwegianLabel: "Avvik, bomtur; Feil adresse",
    price: 590,
  },
  {
    code: "WRONGDATE",
    englishLabel: "Deviation, toll trip; New driving date",
    norwegianLabel: "Avvik, bomtur; Ny kjøredato",
    price: 590,
  },
  {
    code: "CANTFIND",
    englishLabel: "Deviation, missed trip; Warehouse cannot find the product",
    norwegianLabel: "Avvik, bomtur; Lageret finner ikke produktet",
    price: 590,
  },
  {
    code: "CANCELEDBEFORE",
    englishLabel: "Deviation, toll trip; Cancelled the day before",
    norwegianLabel: "Avvik, bomtur; Avlyst dagen før",
    price: 290,
  },
];

const stripDiacritics = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[åÅ]/g, "a");

const normalizeDeviationSearchValue = (value: string): string =>
  stripDiacritics(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");

const extractLegacyCode = (value: string): string | undefined => {
  const parenthesisMatch = value.match(/\(([A-Z0-9]+)\)/u);
  if (parenthesisMatch?.[1]) {
    return parenthesisMatch[1];
  }

  const colonParts = value.split(":");
  const lastPart = colonParts[colonParts.length - 1]?.trim();
  return lastPart && /^[A-Z0-9]+$/u.test(lastPart) ? lastPart : undefined;
};

export function getDeviationFeeOption(
  value: string | null | undefined,
): DeviationFeeOption | undefined {
  if (!value) {
    return undefined;
  }

  const code = extractLegacyCode(value)?.toUpperCase();
  if (code) {
    const byCode = DEVIATION_FEE_OPTIONS.find(
      (option) => option.code === code,
    );
    if (byCode) {
      return byCode;
    }
  }

  const normalized = normalizeDeviationSearchValue(value);
  if (!normalized) {
    return undefined;
  }

  return DEVIATION_FEE_OPTIONS.find((option) => {
    const values = [
      option.code,
      option.englishLabel,
      option.norwegianLabel,
      `${option.price}${option.norwegianLabel}${option.code}`,
      `${option.price}${option.englishLabel}${option.code}`,
    ];

    return values.some(
      (candidate) => normalizeDeviationSearchValue(candidate) === normalized,
    );
  });
}

export function normalizeDeviationLabel(
  value: string | null | undefined,
): string | undefined {
  return getDeviationFeeOption(value)?.englishLabel;
}
