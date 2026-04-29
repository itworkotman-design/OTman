import { DEVIATION_FEE_OPTIONS } from "@/lib/booking/pricing/deviationFees";

const SETTINGS_PREFIX = "__PRICE_LIST_SETTINGS__:";

export type PriceListChargeSetting = {
  code: string;
  description: string;
  price: string;
  subcontractorPrice: string;
};

export type PriceListSettings = {
  extraPickup: PriceListChargeSetting;
  expressDelivery: PriceListChargeSetting;
  xtraPallet: PriceListChargeSetting;
  kmFrom21: PriceListChargeSetting;
  kmOver100: PriceListChargeSetting;
  deviations: Record<string, PriceListChargeSetting>;
};

type PriceListChargeSettingInput = {
  code?: unknown;
  description?: unknown;
  price?: unknown;
  subcontractorPrice?: unknown;
};

function createDefaultChargeSetting(
  code: string,
  description: string,
  price = "0",
  subcontractorPrice = "0",
): PriceListChargeSetting {
  return {
    code,
    description,
    price,
    subcontractorPrice,
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
    xtraPallet: createDefaultChargeSetting(
      "PALLXTRAS1",
      "Ekstra pall",
      "250",
    ),
    kmFrom21: createDefaultChargeSetting(
      "KM_FROM_21",
      "Per km when distance is 21–100 km",
    ),
    kmOver100: createDefaultChargeSetting(
      "KM_OVER_100",
      "Per km when distance is over 100 km",
    ),
    deviations: Object.fromEntries(
      DEVIATION_FEE_OPTIONS.map((option) => [
        option.code,
        createDefaultChargeSetting(
          option.code,
          option.englishLabel,
          String(option.price),
          String(option.subcontractorPrice),
        ),
      ]),
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
    subcontractorPrice: toPriceString(
      input?.subcontractorPrice,
      defaults.subcontractorPrice,
    ),
  };
}

function normalizeDeviationSettings(
  input: unknown,
  defaults: Record<string, PriceListChargeSetting>,
) {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, PriceListChargeSettingInput | undefined>)
      : {};

  return Object.fromEntries(
    Object.entries(defaults).map(([code, defaultSetting]) => [
      code,
      normalizeChargeSetting(source[code], defaultSetting),
    ]),
  );
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
    xtraPallet: normalizeChargeSetting(
      input?.xtraPallet,
      defaults.xtraPallet,
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
    deviations: normalizeDeviationSettings(
      input?.deviations,
      defaults.deviations,
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
