import type { CatalogOption } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { FurnitureOptionSeed } from "@/lib/content/furnitureCatalog";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import { shortenCatalogCode } from "@/lib/content/shortCatalogCode";

// Grouping helpers for the website product card. Furniture's assembly is a
// "type + manufacturer" choice and its dismantling comes in two variants per
// type; both are stored as flat product options, and the card shows them as a
// two-step pick / a paired choice, so it groups them here.

export function buildOptionSeedMap(productCode: string): Map<string, FurnitureOptionSeed> {
  return new Map((findWebsiteProductSeed(productCode)?.options ?? []).map((o) => [o.code, o]));
}

export type AssemblyTypeGroup = {
  key: string;
  label: string;
  /** Cheapest manufacturer's price, for a "from" label on the type row. */
  fromPrice: number;
  options: Array<{ option: CatalogOption; manufacturerLabel: string }>;
};

// Only options whose seed has a type + manufacturer (furniture assembly). White
// goods' install types and Other furniture (no assembly) produce no groups, so
// the card falls back to its plain flat list for them.
export function groupAssemblyOptions(
  options: CatalogOption[],
  seedByCode: Map<string, FurnitureOptionSeed>,
  locale: Locale,
): AssemblyTypeGroup[] {
  const groups = new Map<string, AssemblyTypeGroup>();

  for (const option of options) {
    // Shortened, so an option still stored under its old long code matches too.
    const seed = seedByCode.get(shortenCatalogCode(option.code));
    if (!option.active || seed?.exclusiveGroup !== "type" || !seed.typeEn || !seed.manufacturer) continue;

    const group = groups.get(seed.typeEn) ?? {
      key: seed.typeEn,
      label: locale === "no" ? (seed.typeNo ?? seed.typeEn) : seed.typeEn,
      fromPrice: Number.POSITIVE_INFINITY,
      options: [],
    };
    group.options.push({
      option,
      manufacturerLabel: locale === "no" ? (seed.manufacturerNo ?? seed.manufacturer) : seed.manufacturer,
    });
    group.fromPrice = Math.min(group.fromPrice, Number(option.customerPrice) || 0);
    groups.set(seed.typeEn, group);
  }

  return [...groups.values()];
}

export type DismantlingGroup = {
  key: string;
  label: string;
  disposal?: CatalogOption;
  careful?: CatalogOption;
};

// Matched on the shortened code, so the old long codes (DISMANTLE_DISPOSAL_…)
// pair up the same way until the catalog is reseeded.
const DISMANTLING_CODE = /^DISMANTLE_(DISP|CAR)_(.+)$/;

function afterDash(text: string | null) {
  const value = text ?? "";
  const i = value.lastIndexOf(" — ");
  return i < 0 ? value : value.slice(i + 3);
}

// Pairs "for disposal" and "careful for reuse" per type. Labels come from the
// option's own text (label = English, description = Norwegian, as seeded).
export function groupDismantlingOptions(options: CatalogOption[], locale: Locale): DismantlingGroup[] {
  const groups = new Map<string, DismantlingGroup>();

  for (const option of options) {
    const match = DISMANTLING_CODE.exec(shortenCatalogCode(option.code));
    if (!option.active || !match) continue;

    const [, variant, typeKey] = match;
    const group = groups.get(typeKey) ?? {
      key: typeKey,
      label: afterDash(locale === "no" ? (option.description ?? option.label) : option.label),
    };
    if (variant === "DISP") group.disposal = option;
    else group.careful = option;
    groups.set(typeKey, group);
  }

  return [...groups.values()];
}

// The installation option "Installation only" starts with: the first one the
// card shows — furniture's first assembly type + first manufacturer, else
// white goods' first install type. Null when the product has none.
export function pickDefaultInstallOptionId({
  assemblyGroups,
  typeOptions,
}: {
  assemblyGroups: AssemblyTypeGroup[];
  typeOptions: CatalogOption[];
}): string | null {
  return assemblyGroups[0]?.options[0]?.option.id ?? typeOptions[0]?.id ?? null;
}
