import type {
  CalculatorAdjustments,
  CalculatorResult,
  PriceLookup,
  ProductBreakdown,
  CalculatedLine,
  CalculatedBreakdown,
} from "./types";
import { computeLineKey } from "./lineKey";

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
  let checkboxDiscount = 0;
  let subcontractorCheckboxDiscount = 0;

  for (const product of productBreakdowns) {
    const lines: CalculatedLine[] = [];
    const nulledForCustomerKeys = product.nulledLineKeysForCustomer ?? [];
    const nulledForSubcontractorKeys =
      product.nulledLineKeysForSubcontractor ?? [];

    const pushLine = (line: {
      label: string;
      code?: string;
      qty: number;
      unitPrice: number;
      rawLineTotal: number;
      rawSubcontractorLineTotal: number;
      lineKey: string | null;
    }) => {
      const nulledForCustomer =
        line.lineKey != null && nulledForCustomerKeys.includes(line.lineKey);
      const nulledForSubcontractor =
        line.lineKey != null &&
        nulledForSubcontractorKeys.includes(line.lineKey);

      const lineTotal = nulledForCustomer ? 0 : line.rawLineTotal;
      const subcontractorLineTotal = nulledForSubcontractor
        ? 0
        : line.rawSubcontractorLineTotal;

      if (nulledForCustomer) {
        checkboxDiscount = roundPriceRule(checkboxDiscount + line.rawLineTotal);
      }
      if (nulledForSubcontractor) {
        subcontractorCheckboxDiscount = roundPriceRule(
          subcontractorCheckboxDiscount + line.rawSubcontractorLineTotal,
        );
      }

      subtotalExVat = roundPriceRule(subtotalExVat + lineTotal);
      subcontractorBase = roundPriceRule(
        subcontractorBase + subcontractorLineTotal,
      );

      lines.push({
        label: line.label,
        code: line.code,
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal,
        subcontractorLineTotal,
        lineKey: line.lineKey,
        nulledForCustomer,
        nulledForSubcontractor,
      });
    };

    for (const item of product.items) {
      if (item.kind === "deliveryType") {
        const unitPrice = roundPriceRule(item.unitPrice);
        const subcontractorUnitPrice = roundPriceRule(
          item.subcontractorUnitPrice,
        );

        pushLine({
          label: item.label,
          code: item.code,
          qty: item.qty,
          unitPrice,
          rawLineTotal: roundPriceRule(unitPrice * item.qty),
          rawSubcontractorLineTotal: roundPriceRule(
            subcontractorUnitPrice * item.qty,
          ),
          lineKey: computeLineKey({ code: item.code }),
        });

        continue;
      }

      if (item.kind === "info") {
        lines.push({
          label: item.label,
          qty: item.qty,
          unitPrice: 0,
          lineTotal: 0,
          subcontractorLineTotal: 0,
          lineKey: null,
          nulledForCustomer: false,
          nulledForSubcontractor: false,
        });

        continue;
      }

      if (item.kind === "customPrice") {
        const unitPrice = roundPriceRule(item.unitPrice);
        const subcontractorUnitPrice = roundPriceRule(
          item.subcontractorUnitPrice ?? 0,
        );

        pushLine({
          label: item.label,
          code: item.code,
          qty: item.qty,
          unitPrice,
          rawLineTotal: roundPriceRule(unitPrice * item.qty),
          rawSubcontractorLineTotal: roundPriceRule(
            subcontractorUnitPrice * item.qty,
          ),
          lineKey: computeLineKey({ code: item.code }),
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

      const subcontractorUnitPrice = roundPriceRule(
        item.subcontractorPriceOverride !== undefined
          ? item.subcontractorPriceOverride
          : lookup.subcontractorPrice,
      );

      pushLine({
        label: lookup.label,
        code: lookup.code,
        qty: item.qty,
        unitPrice,
        rawLineTotal: roundPriceRule(unitPrice * item.qty),
        rawSubcontractorLineTotal: roundPriceRule(
          subcontractorUnitPrice * item.qty,
        ),
        lineKey: computeLineKey({ optionId: item.productOptionId }),
      });
    }

    breakdowns.push({
      productName: product.productName,
      productModelNumber: product.productModelNumber ?? null,
      readOnly: product.readOnly,
      comment: product.comment ?? null,
      lines,
      cardId: product.cardId,
      isOrderExtras: product.isOrderExtras,
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
      checkboxDiscount,
      totalExVat,
      vat,
      totalIncVat,
      subcontractorBase: roundPriceRule(subcontractorBase),
      subcontractorMinus,
      subcontractorPlus,
      subcontractorCheckboxDiscount,
      subcontractorTotal,
    },
  };
}
