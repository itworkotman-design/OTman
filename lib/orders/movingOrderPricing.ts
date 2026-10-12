import { websiteInclVat } from "@/lib/booking/pricing/websiteVat";
import { buildOrderPricingSnapshot } from "./orderTotals";

// A homepage moving request's price (app/api/site/moving-request). The moving
// price list holds prices ex. VAT, like every website price list; the
// customer pays the size bracket's price + 25%, rounded to whole kroner — the
// same rule as the white-goods flow (lib/booking/pricing/websiteVat.ts). The
// snapshot keeps that total, so the payment link charges exactly what the
// customer was shown (getOrderChargeAmountIncVatNok).
export function movingOrderPricing(sizeOption: {
  code: string;
  labelEn: string;
  customerPriceCents: number;
  subcontractorPriceCents: number;
}) {
  const priceExVat = Math.round(sizeOption.customerPriceCents / 100);
  const priceSubcontractor = Math.round(sizeOption.subcontractorPriceCents / 100);
  return {
    priceExVat,
    priceSubcontractor,
    pricingSnapshot: buildOrderPricingSnapshot({
      lines: [],
      rabatt: null,
      leggTil: null,
      subcontractorMinus: null,
      subcontractorPlus: null,
      fallbackCustomerTotalExVat: priceExVat,
      fallbackSubcontractorTotal: priceSubcontractor,
      customerTotalIncVat: websiteInclVat(priceExVat),
    }),
  };
}
