import type { Locale } from "@/lib/content/ServiceWindowContent";

const DELIVERY_LABELS: Record<string, { en: string; no: string }> = {
  FIRST_STEP: { en: "Doorstep", no: "Ytterdør" },
  INDOOR: { en: "Carry-in", no: "Innbæring" },
  INSTALL_ONLY: { en: "Installation only", no: "Kun montering" },
};

// Short one-line recap of a configured product card, shown as chips in the
// card header so a collapsed card still tells the customer what they picked.
export function buildCardSummaryChips({
  locale,
  deliveryType,
  installLabel,
  addonCount,
}: {
  locale: Locale;
  deliveryType: string;
  installLabel: string | null;
  addonCount: number;
}): string[] {
  const no = locale === "no";
  const chips: string[] = [];

  const delivery = DELIVERY_LABELS[deliveryType];
  if (delivery) {
    chips.push(`${no ? "Levering" : "Delivery"}: ${no ? delivery.no : delivery.en}`);
  }

  chips.push(
    `${no ? "Montering" : "Installation"}: ${installLabel ?? (no ? "Ingen" : "None")}`,
  );

  if (addonCount > 0) {
    chips.push(no ? `${addonCount} tillegg` : `${addonCount} add-on${addonCount === 1 ? "" : "s"}`);
  }

  return chips;
}
