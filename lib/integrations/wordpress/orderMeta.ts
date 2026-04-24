type LegacyExtraPickupContact = {
  address: string;
  phone: string;
  email: string;
  sendEmail: boolean;
};

const EXTRA_PICKUP_CONTAINER_KEYS = [
  "extra_pickup_locations",
  "field_68248234acd3e",
] as const;

const EXTRA_PICKUP_VALUE_KEYS = ["pickup", "field_68248274acd3f"] as const;

const EXTRA_PICKUP_FLAT_KEY_PATTERNS = [
  /^extra_pickup_locations_\d+_pickup$/u,
  /^extra_pickup_locations_\d+_field_68248274acd3f$/u,
  /^field_68248234acd3e_\d+_pickup$/u,
  /^field_68248234acd3e_\d+_field_68248274acd3f$/u,
  /^field_68248274acd3f(?:_\d+)?$/u,
];

const EXPRESS_META_KEYS = [
  "express_delivery",
  "expresslevering",
  "express",
  "field_684c3ad580b60",
] as const;

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function appendUniqueAddress(
  addresses: string[],
  seen: Set<string>,
  value: unknown,
): void {
  const address = toTrimmedString(value);
  if (!address || seen.has(address)) {
    return;
  }

  seen.add(address);
  addresses.push(address);
}

function appendAddressesFromNestedValue(
  addresses: string[],
  seen: Set<string>,
  value: unknown,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      appendAddressesFromNestedValue(addresses, seen, entry);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of EXTRA_PICKUP_VALUE_KEYS) {
    appendUniqueAddress(addresses, seen, record[key]);
  }
}

function hasTruthyExpressValue(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasTruthyExpressValue(entry));
  }

  const normalized = toTrimmedString(value)?.toLowerCase();
  if (!normalized) {
    return false;
  }

  if (["0", "false", "no", "nei", "off"].includes(normalized)) {
    return false;
  }

  if (["1", "true", "yes", "ja", "on"].includes(normalized)) {
    return true;
  }

  return /express|ekspress/u.test(normalized);
}

export function toWordpressMetaRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function getWordpressExtraPickupAddresses(
  meta: Record<string, unknown>,
): string[] {
  const addresses: string[] = [];
  const seen = new Set<string>();

  for (const key of EXTRA_PICKUP_CONTAINER_KEYS) {
    appendAddressesFromNestedValue(addresses, seen, meta[key]);
  }

  for (const [key, value] of Object.entries(meta)) {
    if (!EXTRA_PICKUP_FLAT_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        appendUniqueAddress(addresses, seen, entry);
      }
      continue;
    }

    appendUniqueAddress(addresses, seen, value);
  }

  return addresses;
}

export function buildWordpressExtraPickupContacts(
  addresses: string[],
): LegacyExtraPickupContact[] {
  return addresses.map((address) => ({
    address,
    phone: "",
    email: "",
    sendEmail: true,
  }));
}

export function getWordpressExpressDelivery(
  meta: Record<string, unknown>,
): boolean {
  for (const key of EXPRESS_META_KEYS) {
    if (hasTruthyExpressValue(meta[key])) {
      return true;
    }
  }

  const priceBreakdownHtml = toTrimmedString(
    meta.price_breakdown_html ?? meta.field_6835ca7fb0cfd,
  );

  if (!priceBreakdownHtml) {
    return false;
  }

  return /express\s+delivery|ekspresslevering|(?:^|[^a-z])express(?:[^a-z]|$)/iu.test(
    priceBreakdownHtml,
  );
}
