"use client";

import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { CustomerType } from "@/lib/booking/pricing/vatDisplayTotal";
import { TileSelectStep } from "./TileSelectStep";

// The very first question in every booking modal that ends up showing
// prices: private customers care about what they actually pay (incl. VAT),
// business customers reclaim VAT and care about the ex-VAT price (see
// getVatDisplayTotal). Asking this before anything else — rather than
// defaulting to "private" and leaving the answer to a toggle discovered
// later, next to the calculator — means every price the customer sees for
// the rest of the flow is already in the right mode from the start.
export function CustomerTypeStep({
  locale,
  value,
  onPick,
}: {
  locale: Locale;
  value: CustomerType | null;
  onPick: (customerType: CustomerType) => void;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  const options: { id: CustomerType; label: string }[] = [
    { id: "private", label: t("Private", "Privat") },
    { id: "business", label: t("Business", "Bedrift") },
  ];

  return <TileSelectStep options={options} value={value} onPick={onPick} />;
}
