import type { PriceListChargeSetting, PriceListSettings } from "@/lib/products/priceListSettings";

// Website price lists hold prices ex. VAT and a private customer sees each
// one +25% (websiteVat.ts). A price ending in 0 for the customer is a
// multiple of 10 incl. VAT, i.e. a multiple of 8 ex. VAT (8 × 1.25 = 10), so
// every customer price on a website list is raised to the next multiple of 8:
// 260 (325 for the customer) → 264 (330). Partner prices are left alone.

const CLEAN_STEP_EX_VAT = 8;

export function cleanWebsiteExVatPrice(amountExVat: number, direction: "up" | "down" = "up"): number {
  const exactSteps = Math.abs(amountExVat) / CLEAN_STEP_EX_VAT;
  const steps = Math.max(0, direction === "up" ? Math.ceil(exactSteps - 1e-9) : Math.floor(exactSteps + 1e-9));
  const cleaned = steps * CLEAN_STEP_EX_VAT;
  return amountExVat < 0 ? -cleaned : cleaned;
}

// Prices stored as text (delivery types, price list settings); anything that
// isn't a number is returned untouched.
export function cleanWebsitePriceString(price: string, direction: "up" | "down" = "up"): string {
  const trimmed = String(price).trim();
  const n = Number(trimmed.replace(",", "."));
  if (trimmed === "" || !Number.isFinite(n)) return price;
  return String(cleanWebsiteExVatPrice(n, direction));
}

// Product.deliveryTypes: each entry's price and xtraPrice. Installation only
// is lowered instead: it's priced just under doorstep delivery (609 vs 610)
// so doorstep keeps the order's full-price slot, and raising both would tie
// them (see websiteDeliveryTypes.ts).
export function cleanWebsiteDeliveryTypes(deliveryTypes: unknown): unknown {
  if (!Array.isArray(deliveryTypes)) return deliveryTypes;
  return deliveryTypes.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const next = { ...(entry as Record<string, unknown>) };
    const direction = next.key === "INSTALL_ONLY" ? "down" : "up";
    for (const field of ["price", "xtraPrice"]) {
      if (typeof next[field] === "string") next[field] = cleanWebsitePriceString(next[field] as string, direction);
    }
    return next;
  });
}

// The order-level fees. The per-km rates are left out: they're small unit
// rates (a 15 kr rate would become 16), not prices a customer sees on their own.
export function cleanWebsitePriceListSettings(settings: PriceListSettings): PriceListSettings {
  const charge = (setting: PriceListChargeSetting): PriceListChargeSetting => ({
    ...setting,
    price: cleanWebsitePriceString(setting.price),
  });
  return {
    ...settings,
    extraPickup: charge(settings.extraPickup),
    expressDelivery: charge(settings.expressDelivery),
    xtraPallet: charge(settings.xtraPallet),
    extraWork: charge(settings.extraWork),
    addToOrder: charge(settings.addToOrder),
    floorSurcharge: charge(settings.floorSurcharge),
    deviations: Object.fromEntries(Object.entries(settings.deviations ?? {}).map(([key, value]) => [key, charge(value)])),
  };
}
