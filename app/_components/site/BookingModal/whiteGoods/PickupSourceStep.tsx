"use client";

import type { Locale } from "@/lib/content/ServiceWindowContent";
import { TileSelectStep } from "./TileSelectStep";

// Where the goods are actually being collected from — a store, a private
// individual (e.g. a used appliance bought off a marketplace), or a
// business/supplier. Purely informational for now (affects wording and what
// staff see, not pricing), asked right before the pickup/delivery address
// fields since it's the context those addresses are collected in.
export type PickupSource = "store" | "private" | "business";

export function PickupSourceStep({
  locale,
  value,
  onPick,
}: {
  locale: Locale;
  value: PickupSource | null;
  onPick: (source: PickupSource) => void;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  const options: { id: PickupSource; label: string }[] = [
    { id: "store", label: t("Store", "Butikk") },
    { id: "private", label: t("Private individual", "Privatperson") },
    { id: "business", label: t("Business", "Bedrift") },
  ];

  return <TileSelectStep options={options} value={value} onPick={onPick} />;
}

// The pickup address placeholder reads a little more naturally once we know
// who it belongs to — same address field, just less generic copy.
export function pickupAddressPlaceholder(locale: Locale, source: PickupSource | null): string {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  switch (source) {
    case "store":
      return t("Store address", "Butikkadresse");
    case "private":
      return t("Their address", "Adressen til privatpersonen");
    case "business":
      return t("Business address", "Bedriftsadresse");
    default:
      return t("Store or delivery point", "Butikk eller hentested");
  }
}
