// Private customers see what they pay (incl. VAT); business customers the
// price ex. VAT (they reclaim the VAT).
export type CustomerType = "private" | "business";

export type VatDisplayTotal = {
  // Which total is shown large/first; the other is shown smaller/secondary.
  primary: "incVat" | "exVat";
  primaryAmount: number;
  secondaryAmount: number;
};

// VAT for homepage (website catalog) orders. The website price lists hold
// prices ex. VAT, like the booking app's, and orders store everything ex. VAT.
// What a private customer sees and pays is each line with 25% Norwegian VAT
// added, rounded to whole kroner, and the order total is the sum of those
// lines (minus the discount, plus the extra, each incl. VAT the same way) —
// so the lines a customer sees always add up to what they pay. Business
// customers see the ex-VAT prices.

export const WEBSITE_VAT_RATE = 0.25;

// One amount ex. VAT → incl. VAT, rounded to whole kroner (half away from
// zero, so a discount of −50 is −63 like +50 is +63).
export function websiteInclVat(amountExVat: number): number {
  const rounded = Math.round(Math.abs(amountExVat) * (1 + WEBSITE_VAT_RATE) + Number.EPSILON);
  return amountExVat < 0 ? -rounded : rounded;
}

// A price as this customer is shown it.
export function websiteCustomerPrice(amountExVat: number, customerType: CustomerType = "private"): number {
  return customerType === "business" ? amountExVat : websiteInclVat(amountExVat);
}

type PricedResult = {
  breakdowns?: { lines: { lineTotal: number }[] }[];
  totals: { totalExVat: number; discount?: number; extra?: number };
};

// The order's totals from a pricing result (priceWebsiteOrder): ex. VAT as
// priced, incl. VAT summed per line — what the customer pays.
export function websiteCustomerTotals(result: PricedResult): { totalExVat: number; totalIncVat: number; vat: number } {
  const lines = (result.breakdowns ?? []).flatMap((breakdown) => breakdown.lines);
  const totalIncVat =
    lines.reduce((sum, line) => sum + websiteInclVat(line.lineTotal), 0) -
    websiteInclVat(result.totals.discount ?? 0) +
    websiteInclVat(result.totals.extra ?? 0);
  const totalExVat = result.totals.totalExVat;
  return { totalExVat, totalIncVat, vat: Math.round((totalIncVat - totalExVat) * 100) / 100 };
}

// Which total leads for this customer, and the other one under it.
export function websiteCustomerTotalDisplay(params: {
  totalExVat: number;
  totalIncVat: number;
  customerType?: CustomerType;
}): VatDisplayTotal {
  return params.customerType === "business"
    ? { primary: "exVat", primaryAmount: params.totalExVat, secondaryAmount: params.totalIncVat }
    : { primary: "incVat", primaryAmount: params.totalIncVat, secondaryAmount: params.totalExVat };
}
