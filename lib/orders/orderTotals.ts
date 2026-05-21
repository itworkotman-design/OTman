type PricedOrderLine = {
  cardId?: number;
  productCode?: string | null;
  productName?: string | null;
  deliveryType?: string | null;
  itemType?: string;
  optionCode?: string | null;
  optionLabel?: string | null;
  quantity: number;
  customerPriceCents: number | null;
  subcontractorPriceCents: number | null;
};

export type OrderPricingSnapshot = {
  version: 1;
  customer: {
    subtotalExVat: number;
    discount: number;
    extra: number;
    totalExVat: number;
    vat: number;
    totalIncVat: number;
  };
  subcontractor: {
    subtotal: number;
    minus: number;
    plus: number;
    total: number;
  };
  lines: Array<{
    cardId: number;
    productCode: string;
    productName: string;
    deliveryType: string;
    itemType: string;
    optionCode: string;
    optionLabel: string;
    quantity: number;
    customerUnitPrice: number | null;
    customerLineTotal: number | null;
    subcontractorUnitPrice: number | null;
    subcontractorLineTotal: number | null;
  }>;
};

function roundNok(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseNokAdjustment(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getOrderLinePriceTotals(lines: PricedOrderLine[]) {
  let hasCustomerLine = false;
  let hasSubcontractorLine = false;
  let customerTotalCents = 0;
  let subcontractorTotalCents = 0;

  for (const line of lines) {
    const quantity = line.quantity > 0 ? line.quantity : 1;

    if (typeof line.customerPriceCents === "number") {
      hasCustomerLine = true;
      customerTotalCents += line.customerPriceCents * quantity;
    }

    if (typeof line.subcontractorPriceCents === "number") {
      hasSubcontractorLine = true;
      subcontractorTotalCents += line.subcontractorPriceCents * quantity;
    }
  }

  return {
    customerSubtotal: hasCustomerLine ? roundNok(customerTotalCents / 100) : null,
    subcontractorSubtotal: hasSubcontractorLine
      ? roundNok(subcontractorTotalCents / 100)
      : null,
  };
}

export function getAdjustedCustomerTotal(params: {
  subtotal: number;
  rabatt: string | null | undefined;
  leggTil: string | null | undefined;
}): number {
  return roundNok(
    params.subtotal -
      parseNokAdjustment(params.rabatt) +
      parseNokAdjustment(params.leggTil),
  );
}

export function getAdjustedSubcontractorTotal(params: {
  subtotal: number;
  subcontractorMinus: string | null | undefined;
  subcontractorPlus: string | null | undefined;
}): number {
  return roundNok(
    params.subtotal -
      parseNokAdjustment(params.subcontractorMinus) +
      parseNokAdjustment(params.subcontractorPlus),
  );
}

function getSnapshotNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getSnapshotRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function getPricingSnapshotCustomerTotal(snapshot: unknown): number | null {
  const root = getSnapshotRecord(snapshot);
  const customer = getSnapshotRecord(root?.customer);
  return getSnapshotNumber(customer?.totalExVat);
}

export function getPricingSnapshotSubcontractorTotal(snapshot: unknown): number | null {
  const root = getSnapshotRecord(snapshot);
  const subcontractor = getSnapshotRecord(root?.subcontractor);
  return getSnapshotNumber(subcontractor?.total);
}

export function buildOrderPricingSnapshot(params: {
  lines: PricedOrderLine[];
  rabatt: string | null | undefined;
  leggTil: string | null | undefined;
  subcontractorMinus: string | null | undefined;
  subcontractorPlus: string | null | undefined;
  fallbackCustomerTotalExVat?: number;
  fallbackSubcontractorTotal?: number;
}): OrderPricingSnapshot {
  const totals = getOrderLinePriceTotals(params.lines);
  const discount = roundNok(parseNokAdjustment(params.rabatt));
  const extra = roundNok(parseNokAdjustment(params.leggTil));
  const hasSubmittedCustomerTotal =
    typeof params.fallbackCustomerTotalExVat === "number";
  const totalExVat = hasSubmittedCustomerTotal
    ? roundNok(params.fallbackCustomerTotalExVat ?? 0)
    : getAdjustedCustomerTotal({
        subtotal: totals.customerSubtotal ?? 0,
        rabatt: params.rabatt,
        leggTil: params.leggTil,
      });
  const customerSubtotal = hasSubmittedCustomerTotal
    ? roundNok(totalExVat + discount - extra)
    : totals.customerSubtotal ?? 0;
  const minus = roundNok(parseNokAdjustment(params.subcontractorMinus));
  const plus = roundNok(parseNokAdjustment(params.subcontractorPlus));
  const hasSubmittedSubcontractorTotal =
    typeof params.fallbackSubcontractorTotal === "number";
  const subcontractorTotal = hasSubmittedSubcontractorTotal
    ? roundNok(params.fallbackSubcontractorTotal ?? 0)
    : getAdjustedSubcontractorTotal({
        subtotal: totals.subcontractorSubtotal ?? 0,
        subcontractorMinus: params.subcontractorMinus,
        subcontractorPlus: params.subcontractorPlus,
      });
  const subcontractorSubtotal = hasSubmittedSubcontractorTotal
    ? roundNok(subcontractorTotal + minus - plus)
    : totals.subcontractorSubtotal ?? 0;
  const vat = roundNok(totalExVat * 0.25);

  return {
    version: 1,
    customer: {
      subtotalExVat: customerSubtotal,
      discount,
      extra,
      totalExVat,
      vat,
      totalIncVat: roundNok(totalExVat + vat),
    },
    subcontractor: {
      subtotal: subcontractorSubtotal,
      minus,
      plus,
      total: subcontractorTotal,
    },
    lines: params.lines.map((line) => {
      const quantity = line.quantity > 0 ? line.quantity : 1;
      const customerUnitPrice =
        typeof line.customerPriceCents === "number"
          ? roundNok(line.customerPriceCents / 100)
          : null;
      const subcontractorUnitPrice =
        typeof line.subcontractorPriceCents === "number"
          ? roundNok(line.subcontractorPriceCents / 100)
          : null;

      return {
        cardId: line.cardId ?? 0,
        productCode: line.productCode ?? "",
        productName: line.productName ?? "",
        deliveryType: line.deliveryType ?? "",
        itemType: line.itemType ?? "",
        optionCode: line.optionCode ?? "",
        optionLabel: line.optionLabel ?? "",
        quantity,
        customerUnitPrice,
        customerLineTotal:
          customerUnitPrice === null ? null : roundNok(customerUnitPrice * quantity),
        subcontractorUnitPrice,
        subcontractorLineTotal:
          subcontractorUnitPrice === null
            ? null
            : roundNok(subcontractorUnitPrice * quantity),
      };
    }),
  };
}
