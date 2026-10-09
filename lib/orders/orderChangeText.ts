import { localizeWebsiteLineLabel, localizeWebsiteProductName } from "@/lib/content/websiteLineLabels";
import { ADJUSTMENT_GROUP, EXTRAS_GROUP, type OrderDetailChange, type OrderLineChange } from "./paidOrderSnapshot";

// Plain-text wording for what changed since the customer paid (see
// compareOrderWithPayments) — shared by the admin WebsiteOrderModal, the
// customer's pay page and the balance-due email, so all three say the same.

export type ChangeLocale = "no" | "en";

export function formatKr(amount: number, options: { signed?: boolean } = {}): string {
  const abs = Math.abs(amount);
  const hasOre = Math.round(abs * 100) % 100 !== 0;
  const number = abs.toLocaleString("nb-NO", {
    minimumFractionDigits: hasOre ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "−" : options.signed && amount > 0 ? "+" : "";
  return `${sign}${number} kr`;
}

const t = (locale: ChangeLocale, no: string, en: string) => (locale === "no" ? no : en);

const STOP_FIELDS: Record<string, [string, string]> = {
  address: ["adresse", "address"],
  place: ["butikk/firma", "store/business"],
  floor: ["etasje", "floor"],
  lift: ["heis", "lift"],
  contact: ["kontakt", "contact"],
};

export function detailLabel(key: string, locale: ChangeLocale): string {
  const pickup = /^pickup\.(\d+)\.(\w+)$/.exec(key);
  if (pickup && STOP_FIELDS[pickup[2]]) {
    const [no, en] = STOP_FIELDS[pickup[2]];
    return `${t(locale, "Henting", "Pickup")} ${pickup[1]}: ${t(locale, no, en)}`;
  }
  switch (key) {
    case "delivery.address":
      return t(locale, "Leveringsadresse", "Delivery address");
    case "delivery.floor":
      return t(locale, "Levering: etasje", "Delivery: floor");
    case "delivery.lift":
      return t(locale, "Levering: heis", "Delivery: lift");
    case "date":
      return t(locale, "Dato", "Date");
    case "timeWindow":
      return t(locale, "Tidsvindu", "Time window");
    case "distance":
      return t(locale, "Kjøreavstand", "Driving distance");
    default:
      return key;
  }
}

function detailValue(key: string, value: string, locale: ChangeLocale): string {
  if (!value) return "—";
  if (key.endsWith(".lift")) return value === "yes" ? t(locale, "Ja", "Yes") : t(locale, "Nei", "No");
  if (key === "distance") return `${value} km`;
  return value;
}

export function describeDetailChange(change: OrderDetailChange, locale: ChangeLocale): string {
  return `${detailLabel(change.key, locale)}: ${detailValue(change.key, change.before, locale)} → ${detailValue(change.key, change.after, locale)}`;
}

// Website lines carry English catalog names and seeded labels — translated
// for Norwegian (localizeWebsiteProductName / localizeWebsiteLineLabel).
function lineName(change: Pick<OrderLineChange, "group" | "label">, locale: ChangeLocale): string {
  if (change.group === EXTRAS_GROUP) return localizeWebsiteLineLabel(change.label, locale);
  if (change.group === ADJUSTMENT_GROUP) {
    return change.label === "discount" ? t(locale, "Rabatt", "Discount") : t(locale, "Tillegg", "Surcharge");
  }
  const group = localizeWebsiteProductName(change.group, locale);
  return change.label && change.label !== change.group ? `${group} — ${localizeWebsiteLineLabel(change.label, locale)}` : group;
}

function qtyPrice(qty: number, price: number): string {
  return `${qty}× ${formatKr(price)}`;
}

export function describeLineChange(change: OrderLineChange, locale: ChangeLocale): string {
  const delta = formatKr(change.delta, { signed: true });
  const name = lineName(change, locale);
  if (change.kind === "added") return `${t(locale, "Lagt til", "Added")}: ${name} (${delta})`;
  if (change.kind === "removed") return `${t(locale, "Fjernet", "Removed")}: ${name} (${delta})`;
  return `${t(locale, "Endret", "Changed")}: ${name}: ${qtyPrice(change.qtyBefore, change.priceBefore)} → ${qtyPrice(change.qtyAfter, change.priceAfter)} (${delta})`;
}
