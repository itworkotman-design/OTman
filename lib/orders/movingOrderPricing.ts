import { websiteInclVat } from "@/lib/booking/pricing/websiteVat";
import { buildOrderPricingSnapshot } from "./orderTotals";

type MovingPricedLine = {
  code: string;
  labelEn: string;
  customerPriceCents: number;
  subcontractorPriceCents: number;
};

// What the customer is shown and pays for a move: the size bracket plus any
// additional services, each line ex. VAT, incl. VAT rounded per line (same
// rule as every website order — lib/booking/pricing/websiteVat.ts). Shared by
// the flow (live total) and movingOrderPricing (stored total), so they can't
// drift apart.
export function movingCustomerTotals(lines: { customerPriceCents: number }[]): {
  totalExVat: number;
  totalIncVat: number;
} {
  const exVat = lines.map((line) => Math.round(line.customerPriceCents / 100));
  return {
    totalExVat: exVat.reduce((sum, amount) => sum + amount, 0),
    totalIncVat: exVat.reduce((sum, amount) => sum + websiteInclVat(amount), 0),
  };
}

// A homepage moving request's price (app/api/site/moving-request). The moving
// price list holds prices ex. VAT, like every website price list; the
// customer pays the size bracket's price plus each additional service's,
// + 25%, rounded to whole kroner per line. The snapshot keeps that total, so
// the payment link charges exactly what the customer was shown
// (getOrderChargeAmountIncVatNok).
export function movingOrderPricing(sizeOption: MovingPricedLine, services: MovingPricedLine[] = []) {
  const lines = [sizeOption, ...services];
  const { totalExVat, totalIncVat } = movingCustomerTotals(lines);
  const priceSubcontractor = lines.reduce((sum, line) => sum + Math.round(line.subcontractorPriceCents / 100), 0);
  return {
    priceExVat: totalExVat,
    priceSubcontractor,
    pricingSnapshot: buildOrderPricingSnapshot({
      lines: [],
      rabatt: null,
      leggTil: null,
      subcontractorMinus: null,
      subcontractorPlus: null,
      fallbackCustomerTotalExVat: totalExVat,
      fallbackSubcontractorTotal: priceSubcontractor,
      customerTotalIncVat: totalIncVat,
    }),
  };
}
