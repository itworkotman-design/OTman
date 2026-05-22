export type DeviationFeeOption = {
  code: string;
  englishLabel: string;
  norwegianLabel: string;
  price: number;
  subcontractorPrice: number;
};

export const DEVIATION_FEE_OPTIONS: DeviationFeeOption[] = [
  {
    code: "NOTHOME",
    englishLabel: "Avvik, bomtur; Kunde ikke hjemme",
    norwegianLabel: "Avvik, bomtur; Kunde ikke hjemme",
    price: 590,
    subcontractorPrice: 390,
  },
  {
    code: "CANCELED",
    englishLabel: "Avvik, bomtur; kunde avbestilt",
    norwegianLabel: "Avvik, bomtur; kunde avbestilt",
    price: 590,
    subcontractorPrice: 149,
  },
  {
    code: "DAMAGESITE",
    englishLabel: "Avvik, bomtur; vare skadet",
    norwegianLabel: "Avvik, bomtur; vare skadet",
    price: 590,
    subcontractorPrice: 390,
  },
  {
    code: "WRONGPROD",
    englishLabel: "Avvik, bomtur levering trapp; Feil vare",
    norwegianLabel: "Avvik, bomtur levering trapp; Feil vare",
    price: 590,
    subcontractorPrice: 390,
  },
  {
    code: "WRONGADRESS",
    englishLabel: "Avvik, bomtur; Feil adresse",
    norwegianLabel: "Avvik, bomtur; Feil adresse",
    price: 590,
    subcontractorPrice: 149,
  },
  {
    code: "WRONGDATE",
    englishLabel: "Avvik, bomtur; Ny kjøredato",
    norwegianLabel: "Avvik, bomtur; Ny kjøredato",
    price: 590,
    subcontractorPrice: 149,
  },
  {
    code: "CANTFIND",
    englishLabel: "Avvik, bomtur; Lageret finner ikke produktet",
    norwegianLabel: "Avvik, bomtur; Lageret finner ikke produktet",
    price: 590,
    subcontractorPrice: 149,
  },
  {
    code: "CANCELEDBEFORE",
    englishLabel: "Avvik, bomtur; Avlyst dagen før",
    norwegianLabel: "Avvik, bomtur; Avlyst dagen før",
    price: 290,
    subcontractorPrice: 0,
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
