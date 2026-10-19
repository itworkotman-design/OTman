import { NONE_FILTER_VALUE } from "@/lib/orders/archiveFilters";
import { KNOWN_DRIVERS, type KnownDriver } from "@/lib/orders/knownDrivers";

export type DriverFilterOption = {
  id: string;
  label: string;
};

function cleanDriverName(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export function isNoDriverValue(value: string | null | undefined): boolean {
  const cleaned = cleanDriverName(value);
  return !cleaned || /^[-–—]+$/.test(cleaned) || /^0+$/.test(cleaned);
}

export function normalizeDriverKey(value: string | null | undefined): string {
  if (isNoDriverValue(value)) return "";

  return cleanDriverName(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("nb-NO")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function hasAtMostOneEdit(left: string, right: string): boolean {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  let shorterIndex = 0;
  let longerIndex = 0;
  let edits = 0;

  while (shorterIndex < shorter.length && longerIndex < longer.length) {
    if (shorter[shorterIndex] === longer[longerIndex]) {
      shorterIndex += 1;
      longerIndex += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (shorter.length === longer.length) {
      shorterIndex += 1;
    }
    longerIndex += 1;
  }

  if (longerIndex < longer.length) edits += 1;
  return edits <= 1;
}

export function areDriverNamesEquivalent(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const leftKey = normalizeDriverKey(left);
  const rightKey = normalizeDriverKey(right);

  if (!leftKey || !rightKey) return !leftKey && !rightKey;
  if (leftKey === rightKey) return true;

  return (
    leftKey.length >= 5 &&
    rightKey.length >= 5 &&
    /^\p{L}+$/u.test(leftKey) &&
    /^\p{L}+$/u.test(rightKey) &&
    hasAtMostOneEdit(leftKey, rightKey)
  );
}

function formatUnknownDriverName(value: string): string {
  const cleaned = cleanDriverName(value);
  const isSingleCase =
    cleaned === cleaned.toLocaleLowerCase("nb-NO") ||
    cleaned === cleaned.toLocaleUpperCase("nb-NO");

  if (!isSingleCase) return cleaned;

  return cleaned
    .toLocaleLowerCase("nb-NO")
    .split(" ")
    .map((word) =>
      word ? `${word[0].toLocaleUpperCase("nb-NO")}${word.slice(1)}` : word,
    )
    .join(" ");
}

function splitDriverValue(value: string): string[] {
  return value
    .trim()
    .replace(/\r?\n/g, ",")
    .replace(/\s+/g, " ")
    .replace(/^[-–—]+\s*/, "")
    .replace(/\s+[-–—]+\s+/g, ",")
    .split(/\s*(?:,|\/|;|\+|&|\s+(?:and|og)\s+)\s*/iu)
    .map(cleanDriverName)
    .filter((part) => !isNoDriverValue(part));
}

function getExactKnownDriver(value: string): KnownDriver | null {
  const key = normalizeDriverKey(value);

  return KNOWN_DRIVERS.find((driver) =>
    [driver.id, driver.name, ...driver.aliases].some(
      (candidate) => normalizeDriverKey(candidate) === key,
    ),
  ) ?? null;
}

function getKnownDriver(value: string): KnownDriver | null {
  const exactMatch = getExactKnownDriver(value);
  if (exactMatch) return exactMatch;

  const valueKey = normalizeDriverKey(value);
  const fuzzyMatches = KNOWN_DRIVERS.filter((driver) =>
    [driver.name, ...driver.aliases].some((candidate) => {
      const candidateKey = normalizeDriverKey(candidate);
      return (
        /^\p{L}+$/u.test(valueKey) &&
        /^\p{L}+$/u.test(candidateKey) &&
        hasAtMostOneEdit(valueKey, candidateKey)
      );
    }),
  );

  return fuzzyMatches.length === 1 ? fuzzyMatches[0] : null;
}

type ResolvedDriverPart = {
  knownDriver: KnownDriver | null;
  label: string;
};

function resolveDriverParts(value: string | null | undefined): ResolvedDriverPart[] {
  if (isNoDriverValue(value)) return [];

  const parts = splitDriverValue(value ?? "");
  const resolved = parts.map((part) => {
    const knownDriver = getKnownDriver(part);
    return {
      knownDriver,
      label: knownDriver?.name ?? formatUnknownDriverName(part),
    };
  });

  return resolved.filter(
    (part, index) =>
      resolved.findIndex((candidate) =>
        part.knownDriver && candidate.knownDriver
          ? candidate.knownDriver.id === part.knownDriver.id
          : normalizeDriverKey(candidate.label) === normalizeDriverKey(part.label),
      ) === index,
  );
}

export function getKnownDriverFilterOptions(): DriverFilterOption[] {
  return KNOWN_DRIVERS.map((driver) => ({
    id: driver.id,
    label: driver.name,
  }));
}

// Builds the driver filter from the drivers actually written on orders.
// Spelling variants collapse into the known driver; names outside the known
// list are kept with their label as id, which matchesDriverFilter accepts.
export function getDriverFilterOptions(
  values: Array<string | null | undefined>,
): DriverFilterOption[] {
  const options: DriverFilterOption[] = [];

  for (const value of values) {
    for (const part of resolveDriverParts(value)) {
      const option = part.knownDriver
        ? { id: part.knownDriver.id, label: part.knownDriver.name }
        : { id: part.label, label: part.label };

      const exists = options.some((existing) =>
        part.knownDriver
          ? existing.id === option.id
          : areDriverNamesEquivalent(existing.label, option.label),
      );

      if (!exists) options.push(option);
    }
  }

  return options.sort((left, right) =>
    left.label.localeCompare(right.label, "nb-NO"),
  );
}

export function matchesDriverFilter(
  value: string | null | undefined,
  filterValue: string | null | undefined,
): boolean {
  if (!filterValue) return true;
  if (filterValue === NONE_FILTER_VALUE) return isNoDriverValue(value);

  const selectedDriver = getExactKnownDriver(filterValue);
  if (!selectedDriver) {
    return resolveDriverParts(value).some((part) =>
      areDriverNamesEquivalent(part.label, filterValue),
    );
  }

  return resolveDriverParts(value).some(
    (part) => part.knownDriver?.id === selectedDriver.id,
  );
}

export function getDriverDisplayLabel(
  value: string | null | undefined,
  noDriverLabel = "No driver",
): string {
  const parts = resolveDriverParts(value);
  return parts.length > 0
    ? parts.map((part) => part.label).join(", ")
    : noDriverLabel;
}
