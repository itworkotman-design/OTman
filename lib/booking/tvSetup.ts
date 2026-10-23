import { MAX_ITEM_NAME_LENGTH } from "@/lib/booking/pricing/sizeBrackets";
import { shortenCatalogCode } from "@/lib/content/shortCatalogCode";

// TV setup (TV_SETUP, an additional service on the TV) is only done
// if the customer has everything the technician needs on site. Booking it asks
// which TV provider they use and has them confirm each checklist item; the
// answers are stored on the card (`tvSetup`) as proof of what was confirmed,
// and the provider is named on the setup line ("TV setup — Altibox") so it
// reaches the order summary, archive and GSM task like "Other manufacturer"
// does. Shared by the booking flow's step readiness and the order routes.

export const TV_SETUP_PROVIDERS = [
  { key: "ALTIBOX", name: "Altibox" },
  { key: "GO3", name: "Go3" },
  { key: "TET", name: "Tet" },
  { key: "OTHER", name: null },
] as const;

export type TvSetupProvider = (typeof TV_SETUP_PROVIDERS)[number]["key"];

export type TvSetupDetails = {
  provider: TvSetupProvider | "";
  // Typed by the customer when provider is OTHER.
  providerName: string;
  // Keys from TV_SETUP_CHECKLIST the customer ticked.
  confirmedItems: string[];
};

export const TV_SETUP_CHECKLIST = [
  { key: "WIFI", en: "Wi-Fi network name and password", no: "Wi-Fi-navn og passord" },
  {
    key: "PROVIDER_LOGIN",
    en: "Username and password for your TV provider",
    no: "Brukernavn og passord til TV-leverandøren din",
  },
  {
    key: "TV_ACCOUNT",
    en: "Password for the TV's own account (e.g. Samsung account), if it has one",
    no: "Passord til TV-ens egen konto (f.eks. Samsung-konto), hvis den har en",
  },
  { key: "POWER", en: "Power cables for the TV and every device", no: "Strømkabler til TV-en og alle enheter" },
  {
    key: "HDMI",
    en: "HDMI cables for every device to connect (decoder, soundbar, game console)",
    no: "HDMI-kabler til alle enheter som skal kobles til (dekoder, lydplanke, spillkonsoll)",
  },
  {
    key: "ETHERNET",
    en: "Network (Ethernet) cable long enough to reach the router, if the TV or decoder is to be wired",
    no: "Nettverkskabel (Ethernet) lang nok til ruteren, hvis TV-en eller dekoderen skal kobles med kabel",
  },
  {
    key: "ANTENNA",
    en: "Antenna / coax cable, if you watch TV through the antenna or cable socket",
    no: "Antenne-/koaksialkabel, hvis du ser TV via antenne- eller kabeluttak",
  },
  {
    key: "REMOTES",
    en: "Remote controls for the TV and decoder, with batteries",
    no: "Fjernkontroller til TV og dekoder, med batterier",
  },
] as const;

type OptionLike = { id: string; code: string; active: boolean };
type ProductLike = { id: string; options: OptionLike[] };
type CardLike = { cardId: number; productId: string | null; selectedExtraOptionIds: string[]; tvSetup?: TvSetupDetails | null };

export function isTvSetupOptionCode(code: string): boolean {
  return shortenCatalogCode(code) === "TV_SETUP";
}

export function cardHasTvSetup(card: CardLike, products: ProductLike[]): boolean {
  const product = card.productId ? products.find((p) => p.id === card.productId) : null;
  if (!product) return false;
  return (product.options ?? []).some(
    (o) =>
      o.active &&
      (card.selectedExtraOptionIds ?? []).includes(o.id) &&
      typeof o.code === "string" &&
      isTvSetupOptionCode(o.code),
  );
}

// A provider picked (and named, for any other provider) and every checklist
// item ticked. Character rules for the typed name are checked separately by
// the route with the shared public-text validator.
export function isTvSetupComplete(details: TvSetupDetails | null | undefined): boolean {
  if (!details || typeof details !== "object") return false;
  if (!TV_SETUP_PROVIDERS.some((p) => p.key === details.provider)) return false;
  if (details.provider === "OTHER") {
    const name = typeof details.providerName === "string" ? details.providerName.trim() : "";
    if (name.length === 0 || name.length > MAX_ITEM_NAME_LENGTH) return false;
  }
  const confirmed = Array.isArray(details.confirmedItems) ? details.confirmedItems : [];
  return TV_SETUP_CHECKLIST.every((item) => confirmed.includes(item.key));
}

export function findTvSetupCardsIncomplete(cards: CardLike[], products: ProductLike[]): number[] {
  return cards
    .filter((card) => cardHasTvSetup(card, products) && !isTvSetupComplete(card.tvSetup))
    .map((card) => card.cardId);
}

export function tvSetupProviderName(details: TvSetupDetails | null | undefined): string {
  if (!details) return "";
  if (details.provider === "OTHER") return typeof details.providerName === "string" ? details.providerName.trim() : "";
  return TV_SETUP_PROVIDERS.find((p) => p.key === details.provider)?.name ?? "";
}

// "TV setup" → "TV setup — Altibox" (either language). Unchanged for any other
// option or while no provider is picked.
export function tvSetupLabel(label: string, optionCode: string | null | undefined, details: TvSetupDetails | null | undefined): string {
  const name = tvSetupProviderName(details);
  if (!name || !optionCode || !isTvSetupOptionCode(optionCode)) return label;
  return `${label} — ${name}`;
}

// A stored order item's option data with the provider on both the English
// label and the Norwegian description (what the archive summary and GSM task
// print). Returned as-is for any other option.
export function withTvSetupProvider<T extends { code: string; label: string; description: string | null }>(
  option: T,
  details: TvSetupDetails | null | undefined,
): T {
  return {
    ...option,
    label: tvSetupLabel(option.label, option.code, details),
    description: option.description ? tvSetupLabel(option.description, option.code, details) : option.description,
  };
}
