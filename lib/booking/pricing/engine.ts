import type {
  CalculatorAdjustments,
  CalculatorResult,
  PriceLookup,
  ProductBreakdown,
  CalculatedLine,
  CalculatedBreakdown,
} from "./types";

function parseNOK(input: string) {
  const s = input.replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function roundPriceRule(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateBookingPricing(params: {
  productBreakdowns: ProductBreakdown[];
  priceLookup: PriceLookup;
  adjustments?: Partial<CalculatorAdjustments>;
}): CalculatorResult {
  const { productBreakdowns, priceLookup, adjustments = {} } = params;

  const rabatt = roundPriceRule(parseNOK(adjustments.rabatt ?? ""));
  const leggTil = roundPriceRule(parseNOK(adjustments.leggTil ?? ""));
  const subcontractorMinus = roundPriceRule(
    parseNOK(adjustments.subcontractorMinus ?? ""),
  );
  const subcontractorPlus = roundPriceRule(
    parseNOK(adjustments.subcontractorPlus ?? ""),
  );

  const breakdowns: CalculatedBreakdown[] = [];

  let subtotalExVat = 0;
  let subcontractorBase = 0;

  for (const product of productBreakdowns) {
    const lines: CalculatedLine[] = [];

    for (const item of product.items) {
      if (item.kind === "deliveryType") {
        const unitPrice = roundPriceRule(item.unitPrice);
        const lineTotal = roundPriceRule(unitPrice * item.qty);

        subtotalExVat = roundPriceRule(subtotalExVat + lineTotal);

        lines.push({
          label: item.label,
          code: item.code,
          qty: item.qty,
          unitPrice,
          lineTotal,
        });

        continue;
      }

      if (item.kind === "info") {
        lines.push({
          label: item.label,
          qty: item.qty,
          unitPrice: 0,
          lineTotal: 0,
        });

        continue;
      }

      if (item.kind === "customPrice") {
        const unitPrice = roundPriceRule(item.unitPrice);
        const subcontractorUnitPrice = roundPriceRule(
          item.subcontractorUnitPrice ?? 0,
        );
        const lineTotal = roundPriceRule(unitPrice * item.qty);
        const subcontractorLineTotal = roundPriceRule(
          subcontractorUnitPrice * item.qty,
        );

        subtotalExVat = roundPriceRule(subtotalExVat + lineTotal);
        subcontractorBase = roundPriceRule(
          subcontractorBase + subcontractorLineTotal,
        );

        lines.push({
          label: item.label,
          code: item.code,
          qty: item.qty,
          unitPrice,
          lineTotal,
        });

        continue;
      }

      const lookup = priceLookup[item.productOptionId];
      if (!lookup) continue;

      const unitPrice = roundPriceRule(
        item.priceOverride !== undefined
          ? item.priceOverride
          : lookup.customerPrice,
      );

      const subcontractorUnitPrice = roundPriceRule(lookup.subcontractorPrice);
      const lineTotal = roundPriceRule(unitPrice * item.qty);
      const subcontractorLineTotal = roundPriceRule(
        subcontractorUnitPrice * item.qty,
      );

      subtotalExVat = roundPriceRule(subtotalExVat + lineTotal);
      subcontractorBase = roundPriceRule(
        subcontractorBase + subcontractorLineTotal,
      );

      lines.push({
        label: lookup.label,
        code: lookup.code,
        qty: item.qty,
        unitPrice,
        lineTotal,
      });
    }

    breakdowns.push({
      productName: product.productName,
      productModelNumber: product.productModelNumber ?? null,
      lines,
    });
  }

  const totalExVat = roundPriceRule(subtotalExVat - rabatt + leggTil);
  const vat = roundPriceRule(totalExVat * 0.25);
  const totalIncVat = roundPriceRule(totalExVat + vat);
  const subcontractorTotal = roundPriceRule(
    subcontractorBase - subcontractorMinus + subcontractorPlus,
  );

  return {
    breakdowns,
    totals: {
      subtotalExVat: roundPriceRule(subtotalExVat),
      discount: rabatt,
      extra: leggTil,
      totalExVat,
      vat,
      totalIncVat,
      subcontractorBase: roundPriceRule(subcontractorBase),
      subcontractorMinus,
      subcontractorPlus,
      subcontractorTotal,
    },
  };
}
