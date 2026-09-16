// Curated, server-validated icon/color options for a saved pickup address —
// deliberately a fixed allow-list (not free-form SVG/hex) so nothing
// client-submitted ever gets rendered as raw markup or arbitrary CSS.
export const ADDRESS_ICON_KEYS = ["storefront", "warehouse", "home", "building", "mappin", "truck", "power"] as const;
export type AddressIconKey = (typeof ADDRESS_ICON_KEYS)[number];
export const DEFAULT_ADDRESS_ICON: AddressIconKey = "storefront";

export const ADDRESS_COLOR_KEYS = ["blue", "green", "amber", "purple", "red", "teal"] as const;
export type AddressColorKey = (typeof ADDRESS_COLOR_KEYS)[number];
export const DEFAULT_ADDRESS_COLOR: AddressColorKey = "blue";

export const ADDRESS_COLOR_CLASSES: Record<AddressColorKey, { bg: string; text: string; swatch: string }> = {
  blue: { bg: "bg-logoblue/10", text: "text-logoblue", swatch: "#273097" },
  green: { bg: "bg-emerald-500/10", text: "text-emerald-600", swatch: "#059669" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600", swatch: "#d97706" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-600", swatch: "#9333ea" },
  red: { bg: "bg-red-500/10", text: "text-red-600", swatch: "#dc2626" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-600", swatch: "#0d9488" },
};

export function isAddressIconKey(value: unknown): value is AddressIconKey {
  return typeof value === "string" && (ADDRESS_ICON_KEYS as readonly string[]).includes(value);
}

export function isAddressColorKey(value: unknown): value is AddressColorKey {
  return typeof value === "string" && (ADDRESS_COLOR_KEYS as readonly string[]).includes(value);
}
