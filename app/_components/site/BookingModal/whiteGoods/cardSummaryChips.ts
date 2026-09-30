import type { Locale } from "@/lib/content/ServiceWindowContent";

const DELIVERY_LABELS: Record<string, { en: string; no: string }> = {
  FIRST_STEP: { en: "Doorstep", no: "Ytterdør" },
  INDOOR: { en: "Carry-in", no: "Innbæring" },
  INSTALL_ONLY: { en: "Installation only", no: "Kun montering" },
};

export type ProductSizeInfo = {
  maxWeightKg: number;
  dimensionsCm?: { w: number; h: number; d: number };
};

// Static max-weight/dimensions spec (parcel/pallet catalog products), e.g.
// "Opptil 15 kg · 20×30×40 cm" — always shown first, since it describes the
// product itself rather than anything the customer picked.
export function formatSizeInfoChip(locale: Locale, sizeInfo: ProductSizeInfo | null): string | null {
  if (!sizeInfo) return null;
  const no = locale === "no";
  const weight = `${no ? "Opptil" : "Up to"} ${sizeInfo.maxWeightKg} kg`;
  if (!sizeInfo.dimensionsCm) return weight;
  const { w, h, d } = sizeInfo.dimensionsCm;
  return `${weight} · ${w}×${h}×${d} cm`;
}

// Short one-line recap of a configured product card, shown as chips in the
// card header so a collapsed card still tells the customer what they picked.
export function buildCardSummaryChips({
  locale,
  deliveryType,
  installLabel,
  showInstallChip,
  addonCount,
  sizeInfo = null,
}: {
  locale: Locale;
  deliveryType: string;
  installLabel: string | null;
  // False when the product has no installation options at all (e.g.
  // pakke/pall catalog items) — the "Montering: None" chip would be
  // meaningless there, so it's left out entirely.
  showInstallChip: boolean;
  addonCount: number;
  // Product's static max-weight/dimensions spec, when it has one.
  sizeInfo?: ProductSizeInfo | null;
}): string[] {
  const no = locale === "no";
  const chips: string[] = [];

  const sizeChip = formatSizeInfoChip(locale, sizeInfo);
  if (sizeChip) chips.push(sizeChip);

  const delivery = DELIVERY_LABELS[deliveryType];
  if (delivery) {
    chips.push(`${no ? "Levering" : "Delivery"}: ${no ? delivery.no : delivery.en}`);
  }

  if (showInstallChip) {
    chips.push(
      `${no ? "Montering" : "Installation"}: ${installLabel ?? (no ? "Ingen" : "None")}`,
    );
  }

  if (addonCount > 0) {
    chips.push(no ? `${addonCount} tillegg` : `${addonCount} add-on${addonCount === 1 ? "" : "s"}`);
  }

  return chips;
}
