export type CustomerType = "private" | "business";

export type VatDisplayTotal = {
  // Which total is shown large/first; the other is shown smaller/secondary.
  primary: "incVat" | "exVat";
  primaryAmount: number;
  secondaryAmount: number;
};

const VAT_RATE = 0.25;

function roundToOre(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Catalog/line prices (product options, delivery, floor surcharge, …) are
// entered and stored as what a private customer actually pays — VAT
// inclusive — so the public booking flow never bothers a private customer
// with VAT math: their price is the stored price, unchanged. Business
// customers reclaim VAT, so the same stored price is shown to them with VAT
// backed out (divided by 1.25).
export function getVatDisplayAmount(
  clientPrice: number,
  customerType: CustomerType = "private",
): number {
  if (customerType === "business") {
    return roundToOre(clientPrice / (1 + VAT_RATE));
  }

  return clientPrice;
}

// The order-total counterpart: same rule as getVatDisplayAmount, but also
// returns the secondary (smaller) VAT-reference figure shown under it —
// private customers see their client total leading with the ex-VAT amount
// underneath; business customers see the ex-VAT amount leading with the
// client total underneath.
export function getVatDisplayTotal(params: {
  total: number;
  customerType?: CustomerType;
}): VatDisplayTotal {
  const { total, customerType = "private" } = params;
  const exVat = roundToOre(total / (1 + VAT_RATE));

  if (customerType === "business") {
    return { primary: "exVat", primaryAmount: exVat, secondaryAmount: total };
  }

  return { primary: "incVat", primaryAmount: total, secondaryAmount: exVat };
}

export type VatBreakdown = { exVat: number; vat: number; incVat: number };

// The full ex-VAT / VAT / incl-VAT breakdown of a client (VAT-inclusive)
// total — used for the final order review, which always shows all three
// regardless of customer type (an actual receipt, not a "don't bother them"
// price).
export function getVatBreakdown(clientTotal: number): VatBreakdown {
  const exVat = roundToOre(clientTotal / (1 + VAT_RATE));
  const vat = roundToOre(clientTotal - exVat);
  return { exVat, vat, incVat: clientTotal };
}
