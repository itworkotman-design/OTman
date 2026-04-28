export function buildSubcontractorPriceWarningNotification(input: {
  customerPrice: number;
  subcontractorPrice: number;
}) {
  return {
    title: "Subcontractor price warning",
    message: [
      "Subcontractor price is higher than customer price.",
      `Customer price: ${input.customerPrice} NOK`,
      `Subcontractor price: ${input.subcontractorPrice} NOK`,
      "Review this order before confirming the pricing.",
    ].join("\n"),
    payload: {
      kind: "SUBCONTRACTOR_PRICE_WARNING" as const,
      customerPrice: input.customerPrice,
      subcontractorPrice: input.subcontractorPrice,
    },
  };
}
