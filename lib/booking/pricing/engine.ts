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

export function calculateBookingPricing(params: {
  productBreakdowns: ProductBreakdown[];
  priceLookup: PriceLookup;
  adjustments?: Partial<CalculatorAdjustments>;
}): CalculatorResult {
  const { productBreakdowns, priceLookup, adjustments = {} } = params;

  const rabatt = parseNOK(adjustments.rabatt ?? "");
  const leggTil = parseNOK(adjustments.leggTil ?? "");
  const subcontractorMinus = parseNOK(adjustments.subcontractorMinus ?? "");
  const subcontractorPlus = parseNOK(adjustments.subcontractorPlus ?? "");

  const breakdowns: CalculatedBreakdown[] = [];

  let subtotalExVat = 0;
  let subcontractorBase = 0;

  for (const product of productBreakdowns) {
    const lines: CalculatedLine[] = [];

    for (const item of product.items) {
      if (item.kind === "deliveryType") {
        const unitPrice = item.unitPrice;
        const lineTotal = unitPrice * item.qty;

        subtotalExVat += lineTotal;

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
        const lineTotal = item.unitPrice * item.qty;
        const subcontractorLineTotal =
          (item.subcontractorUnitPrice ?? 0) * item.qty;

        subtotalExVat += lineTotal;
        subcontractorBase += subcontractorLineTotal;

        lines.push({
          label: item.label,
          code: item.code,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal,
        });

        continue;
      }

      const lookup = priceLookup[item.productOptionId];
      if (!lookup) continue;

      const unitPrice =
        item.priceOverride !== undefined
          ? item.priceOverride
          : lookup.customerPrice;

      const lineTotal = unitPrice * item.qty;
      const subcontractorLineTotal = lookup.subcontractorPrice * item.qty;

      subtotalExVat += lineTotal;
      subcontractorBase += subcontractorLineTotal;

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

  const totalExVat = Math.max(0, subtotalExVat - rabatt + leggTil);
  const vat = totalExVat * 0.25;
  const totalIncVat = totalExVat + vat;
  const subcontractorTotal = Math.max(
    0,
    subcontractorBase - subcontractorMinus + subcontractorPlus,
  );

  return {
    breakdowns,
    totals: {
      subtotalExVat,
      discount: rabatt,
      extra: leggTil,
      totalExVat,
      vat,
      totalIncVat,
      subcontractorBase,
      subcontractorMinus,
      subcontractorPlus,
      subcontractorTotal,
    },
  };
}
