import type { Locale } from "@/lib/content/ServiceWindowContent";
import { WEBSITE_CATALOGS } from "@/lib/content/websiteCatalogs";

// Delivery-type and order-extra lines carry the English label they were seeded
// with (lib/content/websiteDeliveryTypes.ts, seedWebsiteCatalog.ts). The
// Norwegian site shows those known labels translated; anything else (a label
// staff edited, option labels that are already Norwegian) is shown as-is.
const NORWEGIAN_BY_SEEDED_LABEL: Record<string, string> = {
  "Delivery to doorstep": "Levering til ytterdør",
  "Delivery with carry-in": "Levering med innbæring",
  "Installation only": "Kun montering",
  "Return only": "Kun retur",
  "Additional pickup / pickup in another store": "Ekstra hentested / henting i annen butikk",
  "Extra pickup location": "Ekstra hentested",
  "Express delivery": "Ekspresslevering",
  "Per km when distance is over 20 km": "Per km når avstanden er over 20 km",
  "Per km when distance is 21–100 km": "Per km når avstanden er 21–100 km",
  "Per km when distance is over 100 km": "Per km når avstanden er over 100 km",
  "Floor surcharge per chargeable floor, no lift": "Etasjetillegg per etasje uten heis",
};

// Catalog options are stored with their English label (the DB option label);
// the seed data has the Norwegian one. The first catalog's wording wins when
// two products share an English label.
let optionLabels: Map<string, string> | null = null;
function norwegianOptionLabel(label: string): string | undefined {
  if (!optionLabels) {
    optionLabels = new Map();
    for (const product of WEBSITE_CATALOGS.flatMap((catalog) => catalog.products)) {
      for (const option of product.options) {
        if (!optionLabels.has(option.labelEn)) optionLabels.set(option.labelEn, option.labelNo);
      }
    }
  }
  return optionLabels.get(label);
}

export function localizeWebsiteLineLabel(label: string, locale: Locale): string {
  if (locale !== "no") return label;
  const trimmed = label.trim();
  return NORWEGIAN_BY_SEEDED_LABEL[trimmed] ?? norwegianOptionLabel(trimmed) ?? label;
}

// Stored order text (productsSummary, calculator snapshots) names website
// products by their English catalog name. Longest first, so "TV bench" wins
// over "TV".
const PRODUCT_NAMES = WEBSITE_CATALOGS.flatMap((catalog) => catalog.products)
  .map((product) => ({ en: product.nameEn, no: product.nameNo }))
  .sort((a, b) => b.en.length - a.en.length);

// "Washing machine x2" → "Vaskemaskin x2": a known English product name at the
// start, followed by nothing or a suffix (count, "#2", item name), is
// translated; anything else is shown as-is.
export function localizeWebsiteProductName(name: string, locale: Locale): string {
  if (locale !== "no") return name;
  const trimmed = name.trim();
  const match = PRODUCT_NAMES.find((p) => trimmed === p.en || trimmed.startsWith(`${p.en} `));
  return match ? `${match.no}${trimmed.slice(match.en.length)}` : name;
}

// A stored productsSummary ("Washing machine x2, Other furniture (Stool, oak)")
// item by item — commas inside an item name's parentheses don't split it.
export function localizeProductsSummary(summary: string | null, locale: Locale): string | null {
  if (!summary || locale !== "no") return summary;
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < summary.length; i++) {
    const char = summary[i];
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0 && summary[i + 1] === " ") {
      items.push(current);
      current = "";
      i++;
      continue;
    }
    current += char;
  }
  items.push(current);
  return items.map((item) => localizeWebsiteProductName(item, locale)).join(", ");
}

// A stored comma list of line labels (deliveryTypeSummary "Delivery with
// carry-in x2, …", servicesSummary) label by label, keeping an "xN" count.
export function localizeWebsiteLineLabelList(list: string | null, locale: Locale): string | null {
  if (!list || locale !== "no") return list;
  return list
    .split(", ")
    .map((item) => {
      const match = /^(.*?)( x\d+)?$/.exec(item);
      const [, label = item, count = ""] = match ?? [];
      return `${localizeWebsiteLineLabel(label, locale)}${count}`;
    })
    .join(", ");
}
