export type CustomerType = "private" | "business";

export type VatDisplayTotal = {
  // Which total is shown large/first; the other is shown smaller/secondary.
  primary: "incVat" | "exVat";
  primaryAmount: number;
  secondaryAmount: number;
};

// Private customers care about what they actually pay, so incl.-VAT leads;
// business customers reclaim VAT, so ex-VAT leads. Defaults to the private
// (incl.-VAT primary) display, since the public booking flow is
// consumer-facing by default.
export function getVatDisplayTotal(params: {
  totalExVat: number;
  totalIncVat: number;
  customerType?: CustomerType;
}): VatDisplayTotal {
  const { totalExVat, totalIncVat, customerType = "private" } = params;

  if (customerType === "business") {
    return { primary: "exVat", primaryAmount: totalExVat, secondaryAmount: totalIncVat };
  }

  return { primary: "incVat", primaryAmount: totalIncVat, secondaryAmount: totalExVat };
}
