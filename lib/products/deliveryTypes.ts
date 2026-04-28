import { DELIVERY_TYPES } from "@/lib/booking/constants";

export type DeliveryTypeKey =
  | typeof DELIVERY_TYPES.FIRST_STEP
  | typeof DELIVERY_TYPES.INDOOR
  | typeof DELIVERY_TYPES.INSTALL_ONLY
  | typeof DELIVERY_TYPES.RETURN_ONLY;

export type ProductDeliveryType = {
  key: DeliveryTypeKey;
  code: string;
  label: string;
  price: string;
  subcontractorPrice?: string;
  xtraPrice: string;
  xtraSubcontractorPrice?: string;
};

function toNonEmptyString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
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

export const DEFAULT_PRODUCT_DELIVERY_TYPES: ProductDeliveryType[] = [
  {
    key: DELIVERY_TYPES.FIRST_STEP,
    code: "FIRST_STEP",
    label: "Første trinn",
    price: "590",
    subcontractorPrice: "0",
    xtraPrice: "150",
    xtraSubcontractorPrice: "0",
  },
  {
    key: DELIVERY_TYPES.INDOOR,
    code: "INDOOR",
    label: "Innbæring",
    price: "669",
    subcontractorPrice: "0",
    xtraPrice: "229",
    xtraSubcontractorPrice: "0",
  },
  {
    key: DELIVERY_TYPES.INSTALL_ONLY,
    code: "INSTALL_ONLY",
    label: "Kun Installasjon/Montering",
    price: "590",
    subcontractorPrice: "0",
    xtraPrice: "0",
    xtraSubcontractorPrice: "0",
  },
  {
    key: DELIVERY_TYPES.RETURN_ONLY,
    code: "RETURN_ONLY",
    label: "Kun retur",
    price: "669",
    subcontractorPrice: "0",
    xtraPrice: "0",
    xtraSubcontractorPrice: "0",
  },
];

export function createDefaultProductDeliveryTypes() {
  return DEFAULT_PRODUCT_DELIVERY_TYPES.map((item) => ({ ...item }));
}

export function normalizeDeliveryTypeKey(value: unknown): DeliveryTypeKey | "" {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();

  switch (trimmed) {
    case DELIVERY_TYPES.FIRST_STEP:
    case "Første trinn":
    case "FÃ¸rste trinn":
      return DELIVERY_TYPES.FIRST_STEP;
    case DELIVERY_TYPES.INDOOR:
    case "Innbæring":
    case "InnbÃ¦ring":
      return DELIVERY_TYPES.INDOOR;
    case DELIVERY_TYPES.INSTALL_ONLY:
    case "Kun Installasjon/Montering":
      return DELIVERY_TYPES.INSTALL_ONLY;
    case DELIVERY_TYPES.RETURN_ONLY:
    case "Kun retur":
      return DELIVERY_TYPES.RETURN_ONLY;
    default:
      return "";
  }
}

export function normalizeProductDeliveryTypes(
  input: unknown,
): ProductDeliveryType[] {
  const defaults = createDefaultProductDeliveryTypes();

  if (!Array.isArray(input)) {
    return defaults;
  }

  const rawByKey = new Map<DeliveryTypeKey, unknown>();

  for (const value of input) {
    if (!value || typeof value !== "object") continue;

    const rawType = value as {
      key?: unknown;
      code?: unknown;
      label?: unknown;
      price?: unknown;
      subcontractorPrice?: unknown;
      xtraPrice?: unknown;
      xtraSubcontractorPrice?: unknown;
    };
    const key = normalizeDeliveryTypeKey(rawType.key);
    if (!key) continue;
    rawByKey.set(key, rawType);
  }

  return defaults.map((item) => {
    const rawType = rawByKey.get(item.key);

    if (!rawType || typeof rawType !== "object") {
      return item;
    }

    const typedRaw = rawType as {
      code?: unknown;
      label?: unknown;
      price?: unknown;
      subcontractorPrice?: unknown;
      xtraPrice?: unknown;
      xtraSubcontractorPrice?: unknown;
    };

    return {
      key: item.key,
      code: toNonEmptyString(typedRaw.code, item.code),
      label: toNonEmptyString(typedRaw.label, item.label),
      price: toPriceString(typedRaw.price, item.price),
      subcontractorPrice: toPriceString(
        typedRaw.subcontractorPrice,
        item.subcontractorPrice ?? "0",
      ),
      xtraPrice: toPriceString(typedRaw.xtraPrice, item.xtraPrice),
      xtraSubcontractorPrice: toPriceString(
        typedRaw.xtraSubcontractorPrice,
        item.xtraSubcontractorPrice ?? "0",
      ),
    };
  });
}

export function getProductDeliveryType(
  deliveryTypes: ProductDeliveryType[],
  key: DeliveryTypeKey | "",
) {
  if (!key) return null;

  return deliveryTypes.find((item) => item.key === key) ?? null;
}

export function getProductDeliveryTypeLabel(
  deliveryTypes: ProductDeliveryType[],
  key: DeliveryTypeKey | "",
) {
  return getProductDeliveryType(deliveryTypes, key)?.label ?? key;
}

export function getProductDeliveryTypeCode(
  deliveryTypes: ProductDeliveryType[],
  key: DeliveryTypeKey | "",
) {
  return getProductDeliveryType(deliveryTypes, key)?.code ?? key;
}

export function getProductDeliveryTypePrice(params: {
  deliveryTypes: ProductDeliveryType[];
  key: DeliveryTypeKey | "";
  useXtraPrice?: boolean;
  subcontractor?: boolean;
}) {
  const {
    deliveryTypes,
    key,
    useXtraPrice = false,
    subcontractor = false,
  } = params;
  const type = getProductDeliveryType(deliveryTypes, key);

  if (!type) return 0;

  const value = subcontractor
    ? useXtraPrice
      ? type.xtraSubcontractorPrice
      : type.subcontractorPrice
    : useXtraPrice
      ? type.xtraPrice
      : type.price;

  const parsed = Number((value ?? "0").replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}
