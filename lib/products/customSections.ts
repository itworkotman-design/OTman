export type ProductCustomSectionOption = {
  id: string;
  code: string;
  label: string;
  price: string;
  subcontractorPrice?: string;
};

export type ProductCustomSection = {
  id: string;
  title: string;
  usePrices: boolean;
  allowMultiple: boolean;
  options: ProductCustomSectionOption[];
};

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function toPriceString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") return "0";

  const trimmed = value.trim();
  if (!trimmed) return "0";

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0";
}

function createId(prefix: string, index: number) {
  return `${prefix}_${index + 1}`;
}

export function normalizeProductCustomSections(
  input: unknown,
): ProductCustomSection[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((section, sectionIndex) => {
      if (!section || typeof section !== "object") return null;

      const rawSection = section as {
        id?: unknown;
        title?: unknown;
        usePrices?: unknown;
        allowMultiple?: unknown;
        options?: unknown;
      };

      const normalizedOptions = Array.isArray(rawSection.options)
        ? rawSection.options
            .map((option, optionIndex) => {
              if (!option || typeof option !== "object") return null;

              const rawOption = option as {
                id?: unknown;
                code?: unknown;
                label?: unknown;
                price?: unknown;
                subcontractorPrice?: unknown;
              };

              return {
                id:
                  toNonEmptyString(rawOption.id) ||
                  createId("option", optionIndex),
                code: toNonEmptyString(rawOption.code),
                label: toNonEmptyString(rawOption.label),
                price: toPriceString(rawOption.price),
                subcontractorPrice: toPriceString(
                  rawOption.subcontractorPrice,
                ),
              };
            })
            .filter((option) => option !== null)
        : [];

      return {
        id:
          toNonEmptyString(rawSection.id) || createId("section", sectionIndex),
        title: toNonEmptyString(rawSection.title),
        usePrices: !!rawSection.usePrices,
        allowMultiple:
          rawSection.allowMultiple === undefined
            ? true
            : !!rawSection.allowMultiple,
        options: normalizedOptions,
      };
    })
    .filter((section) => section !== null);
}
