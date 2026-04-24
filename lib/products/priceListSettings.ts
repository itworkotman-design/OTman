const SETTINGS_PREFIX = "__PRICE_LIST_SETTINGS__:";

export type PriceListChargeSetting = {
  code: string;
  description: string;
  price: string;
};

export type PriceListSettings = {
  extraPickup: PriceListChargeSetting;
  expressDelivery: PriceListChargeSetting;
  kmFrom21: PriceListChargeSetting;
  kmOver100: PriceListChargeSetting;
};

type PriceListChargeSettingInput = {
  code?: unknown;
  description?: unknown;
  price?: unknown;
};

function createDefaultChargeSetting(
  code: string,
  description: string,
  price = "0",
): PriceListChargeSetting {
  return {
    code,
    description,
    price,
  };
}

export function createDefaultPriceListSettings(): PriceListSettings {
  return {
    extraPickup: createDefaultChargeSetting(
      "EXTRA_PICKUP",
      "Extra pickup location",
    ),
    expressDelivery: createDefaultChargeSetting(
      "EXPRESS_DELIVERY",
      "Express delivery",
    ),
    kmFrom21: createDefaultChargeSetting(
      "KM_FROM_21",
      "Per km when distance is 21–100 km",
    ),
    kmOver100: createDefaultChargeSetting(
      "KM_OVER_100",
      "Per km when distance is over 100 km",
    ),
  };
}

function toTextString(value: unknown, fallback: string) {
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

  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : fallback;
}

function normalizeChargeSetting(
  input: PriceListChargeSettingInput | null | undefined,
  defaults: PriceListChargeSetting,
): PriceListChargeSetting {
  return {
    code: toTextString(input?.code, defaults.code),
    description: toTextString(input?.description, defaults.description),
    price: toPriceString(input?.price, defaults.price),
  };
}

export function normalizePriceListSettings(
  input: Partial<PriceListSettings> | null | undefined,
): PriceListSettings {
  const defaults = createDefaultPriceListSettings();
  const legacyInput = (input ?? {}) as {
    extraPickupPrice?: unknown;
    kmPrice?: unknown;
  };
  const legacyKmPrice = toPriceString(legacyInput.kmPrice, defaults.kmFrom21.price);

  return {
    extraPickup: normalizeChargeSetting(
      input?.extraPickup
        ? input.extraPickup
        : {
            price: legacyInput.extraPickupPrice,
          },
      defaults.extraPickup,
    ),
    expressDelivery: normalizeChargeSetting(
      input?.expressDelivery,
      defaults.expressDelivery,
    ),
    kmFrom21: normalizeChargeSetting(
      input?.kmFrom21
        ? input.kmFrom21
        : {
            price: legacyInput.kmPrice,
          },
      defaults.kmFrom21,
    ),
    kmOver100: normalizeChargeSetting(
      input?.kmOver100
        ? input.kmOver100
        : {
            price: legacyKmPrice,
          },
      defaults.kmOver100,
    ),
  };
}

export function parsePriceListSettings(description: string | null | undefined) {
  const raw = (description ?? "").trim();

  if (!raw.startsWith(SETTINGS_PREFIX)) {
    return createDefaultPriceListSettings();
  }

  try {
    const parsed = JSON.parse(raw.slice(SETTINGS_PREFIX.length)) as
      | Partial<PriceListSettings>
      | null;

    return normalizePriceListSettings(parsed);
  } catch {
    return createDefaultPriceListSettings();
  }
}

export function serializePriceListSettings(settings: PriceListSettings) {
  return `${SETTINGS_PREFIX}${JSON.stringify(
    normalizePriceListSettings(settings),
  )}`;
}
