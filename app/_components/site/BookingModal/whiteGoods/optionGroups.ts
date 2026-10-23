import type { CatalogOption } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { FurnitureOptionSeed } from "@/lib/content/furnitureCatalog";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import { shortenCatalogCode } from "@/lib/content/shortCatalogCode";

// Grouping helpers for the website product card. Furniture's assembly is a
// "type + manufacturer" choice and its dismantling comes in two variants (for
// disposal / for reuse); both are stored as flat product options, and the card shows them as a
// two-step pick / a paired choice, so it groups them here.

export function buildOptionSeedMap(productCode: string): Map<string, FurnitureOptionSeed> {
  return new Map((findWebsiteProductSeed(productCode)?.options ?? []).map((o) => [o.code, o]));
}

export type AssemblyTypeGroup = {
  key: string;
  label: string;
  /** What the second step picks: furniture's manufacturer or the TV's size. */
  choiceKind: "manufacturer" | "size";
  /** Cheapest choice's price, for a "from" label on the type row. */
  fromPrice: number;
  options: Array<{ option: CatalogOption; choiceLabel: string }>;
};

// Only options whose seed has a type + manufacturer (furniture assembly) or a
// type + size (TV install). Other white goods' install types and Other
// furniture (no assembly) produce no groups, so the card falls back to its
// plain flat list for them.
export function groupAssemblyOptions(
  options: CatalogOption[],
  seedByCode: Map<string, FurnitureOptionSeed>,
  locale: Locale,
): AssemblyTypeGroup[] {
  const groups = new Map<string, AssemblyTypeGroup>();

  for (const option of options) {
    // Shortened, so an option still stored under its old long code matches too.
    const seed = seedByCode.get(shortenCatalogCode(option.code));
    if (!option.active || seed?.exclusiveGroup !== "type" || !seed.typeEn) continue;
    const choiceLabel = seed.manufacturer
      ? locale === "no" ? (seed.manufacturerNo ?? seed.manufacturer) : seed.manufacturer
      : seed.size;
    if (!choiceLabel) continue;

    const group = groups.get(seed.typeEn) ?? {
      key: seed.typeEn,
      label: locale === "no" ? (seed.typeNo ?? seed.typeEn) : seed.typeEn,
      choiceKind: seed.manufacturer ? "manufacturer" : "size",
      fromPrice: Number.POSITIVE_INFINITY,
      options: [],
    };
    group.options.push({ option, choiceLabel });
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

// Pairs "for disposal" and "careful for reuse" (one pair today; older
// catalogs had one per type or size). Labels come from the
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

function dismantlingOptionIds(groups: DismantlingGroup[]) {
  return new Set(groups.flatMap((g) => [g.disposal?.id, g.careful?.id]).filter((id): id is string => !!id));
}

// One dismantling choice per item: picking either variant replaces the one
// already picked, picking it again clears it. Other extras are kept.
export function toggleDismantlingSelection(
  selectedIds: string[],
  groups: DismantlingGroup[],
  optionId: string,
): string[] {
  const dismantlingIds = dismantlingOptionIds(groups);
  const rest = selectedIds.filter((id) => !dismantlingIds.has(id));
  return selectedIds.includes(optionId) ? rest : [...rest, optionId];
}

// The card's "Dismantling" checkbox: ticking it starts on for disposal,
// unticking it clears whichever variant is picked.
export function toggleDismantlingEnabled(selectedIds: string[], groups: DismantlingGroup[]): string[] {
  const dismantlingIds = dismantlingOptionIds(groups);
  const rest = selectedIds.filter((id) => !dismantlingIds.has(id));
  if (rest.length < selectedIds.length) return rest;
  const first = groups[0]?.disposal ?? groups[0]?.careful;
  return first ? [...selectedIds, first.id] : selectedIds;
}

// The installation option "Installation only" starts with: the first one the
// card shows — the first grouped type + its first choice (furniture's
// manufacturer, the TV's size), else white goods' first install type. Null when the product has none.
export function pickDefaultInstallOptionId({
  assemblyGroups,
  typeOptions,
}: {
  assemblyGroups: AssemblyTypeGroup[];
  typeOptions: CatalogOption[];
}): string | null {
  return assemblyGroups[0]?.options[0]?.option.id ?? typeOptions[0]?.id ?? null;
}
