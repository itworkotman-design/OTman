export type FrozenOrderPricingTotals = {
  totalExVat: number;
  subcontractorTotal: number;
};

function roundPriceRule(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCurrentTotalsWithFrozenExternalLines(params: {
  stored: FrozenOrderPricingTotals;
  snapshotCalculated: FrozenOrderPricingTotals;
  currentCatalogCalculated: FrozenOrderPricingTotals;
}): FrozenOrderPricingTotals {
  const customerDelta = roundPriceRule(params.stored.totalExVat - params.snapshotCalculated.totalExVat);
  const subcontractorDelta = roundPriceRule(params.stored.subcontractorTotal - params.snapshotCalculated.subcontractorTotal);

  return {
    totalExVat: roundPriceRule(params.currentCatalogCalculated.totalExVat + customerDelta),
    subcontractorTotal: roundPriceRule(params.currentCatalogCalculated.subcontractorTotal + subcontractorDelta),
  };
}

export function frozenOrderTotalsDiffer(first: FrozenOrderPricingTotals, second: FrozenOrderPricingTotals) {
  return (
    roundPriceRule(first.totalExVat) !== roundPriceRule(second.totalExVat) ||
    roundPriceRule(first.subcontractorTotal) !== roundPriceRule(second.subcontractorTotal)
  );
}
