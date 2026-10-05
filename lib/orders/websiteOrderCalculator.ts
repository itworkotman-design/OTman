import { deriveDiscountSync } from "@/lib/booking/pricing/discountSync";
import type { CalculatorResult } from "@/lib/booking/pricing/types";

// The calculator in WebsiteOrderModal, shown like the booking app's
// (CalculatorDisplayNew + SubcontractorCalculatorDisplay): every priced line
// with what the customer pays and what the partner gets, then each side's
// adjustments and total. Built from the same priceWebsiteOrder result the
// order is stored at, so it always matches the saved price.
//
// Website prices already include VAT, so the customer's `total` is what they
// pay (Order.priceExVat holds it as-is for WHITE_GOODS orders).

export type WebsiteOrderCalculatorLine = {
  label: string;
  code: string | null;
  qty: number;
  customer: number;
  // null when the viewer may not see partner prices.
  partner: number | null;
};

export type WebsiteOrderCalculatorView = {
  products: { name: string; isOrderExtras: boolean; lines: WebsiteOrderCalculatorLine[] }[];
  customer: { subtotal: number; discount: number; extra: number; total: number };
  partner: { base: number; minus: number; plus: number; total: number } | null;
};

export function websiteOrderCalculatorView(
  result: CalculatorResult,
  { includePartner }: { includePartner: boolean },
): WebsiteOrderCalculatorView {
  const { totals } = result;
  return {
    products: (result.breakdowns ?? []).map((product) => ({
      name: product.productName,
      isOrderExtras: product.isOrderExtras === true,
      lines: product.lines.map((line) => ({
        label: line.label,
        code: line.code ?? null,
        qty: line.qty,
        customer: line.lineTotal,
        partner: includePartner ? (line.subcontractorLineTotal ?? 0) : null,
      })),
    })),
    customer: {
      subtotal: totals.subtotalExVat,
      discount: totals.discount + totals.checkboxDiscount,
      extra: totals.extra,
      total: totals.totalExVat,
    },
    partner: includePartner
      ? {
          base: totals.subcontractorBase,
          minus: totals.subcontractorMinus + totals.subcontractorCheckboxDiscount,
          plus: totals.subcontractorPlus,
          total: totals.subcontractorTotal,
        }
      : null,
  };
}

// The booking app's rule (BookingEditor handleAdjustmentsChange): a discount
// cuts the partner's pay by the same share — the partner minus follows the
// discount until an admin types their own.
export function partnerMinusForDiscount(input: { rabatt: string; subtotal: number; partnerBase: number }): string {
  const sync = deriveDiscountSync({
    dnbDiscount: false,
    manualRabatt: input.rabatt,
    leggTil: "",
    subtotalExVat: input.subtotal,
    subcontractorBase: input.partnerBase,
    isInitialSyncForExistingOrder: false,
  });
  return sync.skip ? "" : (sync.subcontractorMinus ?? "");
}
