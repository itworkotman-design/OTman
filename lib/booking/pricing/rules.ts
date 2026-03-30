import {
  DELIVERY_TYPES,
  OPTION_CODES,
  OPTION_CATEGORIES,
} from "@/lib/booking/constants";

export function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizedUpper(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export function isReturnOption(
  category: string | null | undefined,
  code: string | null | undefined,
) {
  const c = normalized(category);
  const x = normalized(code);

  return (
    c === OPTION_CATEGORIES.RETURN ||
    c === "retur" ||
    x.includes("return") ||
    x.includes("retur")
  );
}

export function isXtraOption(
  category: string | null | undefined,
  code: string | null | undefined,
) {
  const c = normalized(category);
  const x = normalized(code);

  return c === OPTION_CATEGORIES.XTRA || x.includes("xtra");
}

export function isInstallOption(
  category: string | null | undefined,
  code: string | null | undefined,
) {
  const c = normalized(category);

  if (isReturnOption(category, code)) return false;
  if (isXtraOption(category, code)) return false;

  return c === OPTION_CATEGORIES.INSTALL;
}

export function isExtraCheckboxOption(code: string | null | undefined) {
  const x = normalizedUpper(code);

  return x === OPTION_CODES.UNPACKING || x === OPTION_CODES.DEMONT;
}

export function showsInstallOptions(deliveryType: string) {
  return (
    deliveryType === DELIVERY_TYPES.INDOOR ||
    deliveryType === DELIVERY_TYPES.INSTALL_ONLY
  );
}

export function showsReturnOptions(deliveryType: string) {
  return (
    deliveryType === DELIVERY_TYPES.INDOOR ||
    deliveryType === DELIVERY_TYPES.INSTALL_ONLY ||
    deliveryType === DELIVERY_TYPES.RETURN_ONLY
  );
}

export function showsExtraCheckboxes(deliveryType: string) {
  return deliveryType === DELIVERY_TYPES.INDOOR;
}

export function isDeliveryTypeWithExtraAmount(deliveryType: string) {
  return (
    deliveryType === DELIVERY_TYPES.FIRST_STEP ||
    deliveryType === DELIVERY_TYPES.INDOOR ||
    deliveryType === DELIVERY_TYPES.INSTALL_ONLY
  );
}

export function shouldPriceReturnOption(deliveryType: string) {
  return deliveryType !== DELIVERY_TYPES.RETURN_ONLY;
}
