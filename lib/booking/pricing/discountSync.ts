import { parseNokAdjustment } from "@/lib/orders/orderTotals";

function formatAdjustmentAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function calculateDnbDiscountAdjustment(params: {
  subtotalExVat: number;
  currentRabatt: string;
  currentLeggTil: string;
  previousDnbDiscount: number;
}): { dnbDiscount: number; totalDiscountText: string } {
  const currentDiscount = parseNokAdjustment(params.currentRabatt);
  const currentExtra = parseNokAdjustment(params.currentLeggTil);
  const baseDiscount = Math.max(0, currentDiscount - params.previousDnbDiscount);
  const remainingTotal = Math.max(0, params.subtotalExVat - baseDiscount + currentExtra);
  const dnbDiscount = Math.round(remainingTotal * 0.2);
  const totalDiscount = baseDiscount + dnbDiscount;

  return {
    dnbDiscount,
    totalDiscountText: formatAdjustmentAmount(totalDiscount),
  };
}

export type DiscountSyncInput = {
  dnbDiscount: boolean;
  manualRabatt: string;
  leggTil: string;
  subtotalExVat: number;
  subcontractorBase: number;
  // True only for the first sync after loading an existing order's saved
  // rabatt/subcontractorMinus into form state. That first pass can run
  // before the saved product cards (and therefore subtotalExVat/
  // subcontractorBase) have actually settled, so recomputing from them here
  // would silently overwrite a correctly persisted — possibly manually
  // overridden — subcontractorMinus with a formula result derived from
  // stale/zero totals. Real bug: an order with rabatt="610" and a manually
  // set subcontractorMinus="5500" (paying the subcontractor nothing) got
  // silently rewritten to "414" (the proportional-to-rabatt formula result)
  // every time the order was reopened or an unrelated field was saved.
  isInitialSyncForExistingOrder: boolean;
};

export type DiscountSyncResult =
  | { skip: true }
  | {
      skip: false;
      rabatt: string;
      // null means "leave subcontractorMinus untouched" — distinct from ""
      // which means "clear it". Only the DNB branch can produce null (see
      // below); the manual-rabatt branch always resolves to a string.
      subcontractorMinus: string | null;
    };

// Decides how `rabatt`/`subcontractorMinus` should be resynced in response
// to the DNB-discount toggle (or, for a brand-new order, the discount
// inputs settling for the first time). This must only ever be invoked in
// direct response to a genuine change in `dnbDiscount` (or, for a new
// order, `manualRabatt`/`leggTil`) — never merely because pricing totals
// recalculated for an unrelated reason (hours, quantities, an unrelated
// field save reloading the order). Reacting to totals churn was the root
// cause of the bug this function guards against: see
// isInitialSyncForExistingOrder above, and lib/booking/pricing/discountSync.test.ts
// for the exact regression scenarios.
export function deriveDiscountSync(input: DiscountSyncInput): DiscountSyncResult {
  if (input.isInitialSyncForExistingOrder) {
    return { skip: true };
  }

  const { dnbDiscount, manualRabatt, leggTil, subtotalExVat, subcontractorBase } = input;

  if (dnbDiscount) {
    const adjustment = calculateDnbDiscountAdjustment({
      subtotalExVat,
      currentRabatt: manualRabatt,
      currentLeggTil: leggTil,
      previousDnbDiscount: 0,
    });
    const rabattAmount = parseNokAdjustment(adjustment.totalDiscountText);
    const subcontractorMinus =
      Number.isFinite(rabattAmount) && rabattAmount > 0 && subtotalExVat > 0
        ? String(Math.round((subcontractorBase * rabattAmount) / subtotalExVat))
        : null;

    return { skip: false, rabatt: adjustment.totalDiscountText, subcontractorMinus };
  }

  const manualRabattAmount = parseNokAdjustment(manualRabatt);
  const subcontractorMinus =
    Number.isFinite(manualRabattAmount) && manualRabattAmount > 0 && subtotalExVat > 0
      ? String(Math.round((subcontractorBase * manualRabattAmount) / subtotalExVat))
      : "";

  return { skip: false, rabatt: manualRabatt, subcontractorMinus };
}
