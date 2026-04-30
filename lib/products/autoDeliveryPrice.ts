export type ProductAutoDeliveryPrice = {
  enabled: boolean;
  code: string;
  label: string;
  price: string;
  subcontractorPrice: string;
};

export function createDefaultProductAutoDeliveryPrice(): ProductAutoDeliveryPrice {
  return {
    enabled: false,
    code: "AUTO_DELIVERY",
    label: "Delivery price",
    price: "0",
    subcontractorPrice: "0",
  };
}

function toStringValue(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function toPriceString(value: unknown, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(value);
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : fallback;
}

export function normalizeProductAutoDeliveryPrice(
  input: unknown,
): ProductAutoDeliveryPrice {
  const defaults = createDefaultProductAutoDeliveryPrice();

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return defaults;
  }

  const raw = input as {
    enabled?: unknown;
    code?: unknown;
    label?: unknown;
    price?: unknown;
    subcontractorPrice?: unknown;
  };

  return {
    enabled: raw.enabled === true,
    code: toStringValue(raw.code, defaults.code),
    label: toStringValue(raw.label, defaults.label),
    price: toPriceString(raw.price, defaults.price),
    subcontractorPrice: toPriceString(
      raw.subcontractorPrice,
      defaults.subcontractorPrice,
    ),
  };
}
