import { MAX_ITEM_NAME_LENGTH } from "@/lib/booking/pricing/sizeBrackets";
import { shortenCatalogCode } from "@/lib/content/shortCatalogCode";

// Furniture assembly is a type + manufacturer pick ("Single bed — IKEA"); the
// "— Other manufacturer" choice (ASM_…_OTHER) asks the customer which company
// made it. The answer goes in the card's free-text field (modelNumber), so it
// is stored and shown like any model number ("Bed - Hästens" in the order
// summary, archive and GSM task) with no new card/schema field. Shared by the
// booking flow's step readiness, the dashboard editor and the order routes.

type OptionLike = { id: string; code: string; active: boolean };
type ProductLike = { id: string; options: OptionLike[] };
type CardLike = { cardId: number; productId: string | null; selectedInstallOptionIds: string[]; modelNumber: string };

// Shortened first, so an option still stored under its old long code
// (…_OTHER_MANUFACTURER) matches too.
export function isOtherManufacturerOptionCode(code: string): boolean {
  return /^ASM_.+_OTHER$/.test(shortenCatalogCode(code));
}

export function cardHasOtherManufacturer(card: CardLike, products: ProductLike[]): boolean {
  const product = card.productId ? products.find((p) => p.id === card.productId) : null;
  if (!product) return false;
  return (product.options ?? []).some(
    (o) =>
      o.active &&
      (card.selectedInstallOptionIds ?? []).includes(o.id) &&
      typeof o.code === "string" &&
      isOtherManufacturerOptionCode(o.code),
  );
}

// Other-manufacturer cards whose company name is missing, blank, too long or
// not a string. Character rules are checked separately by the route with the
// shared public-text validator.
export function findOtherManufacturerCardsMissingName(cards: CardLike[], products: ProductLike[]): number[] {
  return cards
    .filter((card) => {
      if (!cardHasOtherManufacturer(card, products)) return false;
      const name = typeof card.modelNumber === "string" ? card.modelNumber.trim() : "";
      return name.length === 0 || name.length > MAX_ITEM_NAME_LENGTH;
    })
    .map((card) => card.cardId);
}

// "Single bed — Other manufacturer" → "Single bed — Hästens" (either
// language: everything after the last " — " is the manufacturer). Unchanged
// for any other option or while no company is typed.
export function otherManufacturerLabel(label: string, optionCode: string | null | undefined, company: string | null | undefined): string {
  const name = typeof company === "string" ? company.trim() : "";
  if (!name || !optionCode || !isOtherManufacturerOptionCode(optionCode)) return label;
  const dash = label.lastIndexOf(" — ");
  return dash < 0 ? `${label} — ${name}` : `${label.slice(0, dash)} — ${name}`;
}
