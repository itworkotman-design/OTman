import { MOVING_DEVIATION_ITEM_CODE, MOVING_EXPRESS_ITEM_CODE } from "@/lib/content/movingCatalog";
import {
  movingOrderAdjustedPricing,
  movingOrderCalculatorView,
  type CalculatorMainGroup,
  type MovingAdjustments,
} from "./movingOrderCalculator";
import type { MovingOrderItem } from "./movingOrderView";

// A homepage service request in the admin calculator (WebsiteOrderCalculator):
// staff's quotes (one line per service, serviceQuoteItemRows) as the service, and express
// and the deviation as order extras — the same lines a move gets
// (movingHandlingItemRows, priced from the moving price list's settings), so
// a service is priced exactly like a move: the discount/extra, partner
// minus/plus and lines set to 0 on top (movingOrderCalculator). Not quoted
// yet: no lines, 0 kr.

export const SERVICE_QUOTE_PRODUCT_CODE = "SERVICE_QUOTE";
// One quote line per service, keyed by its service code, so each can be set
// to 0 on its own and keeps that through other changes.
export function serviceQuoteOptionCode(serviceCode: string): string {
  return `QUOTE:${serviceCode}`;
}
// A request stored before services were a list had one line with this code.
export const LEGACY_SERVICE_QUOTE_OPTION_CODE = "QUOTE";

// Every order line a service request writes — what a save replaces.
export const SERVICE_ITEM_PRODUCT_CODES = [SERVICE_QUOTE_PRODUCT_CODE, MOVING_EXPRESS_ITEM_CODE, MOVING_DEVIATION_ITEM_CODE];

const SERVICE_GROUP: CalculatorMainGroup = {
  name: "Service",
  isMain: (item) => item.productCode === SERVICE_QUOTE_PRODUCT_CODE,
};

export function serviceOrderCalculatorView(
  items: MovingOrderItem[],
  adjustments: MovingAdjustments,
  { includePartner }: { includePartner: boolean },
) {
  return movingOrderCalculatorView(items, adjustments, { includePartner, mainGroup: SERVICE_GROUP });
}

// What a service request stores (Order.priceExVat, priceSubcontractor,
// pricingSnapshot) for its lines and adjustments — the calculator's totals.
export function serviceOrderAdjustedPricing(
  rows: Parameters<typeof movingOrderAdjustedPricing>[0],
  adjustments: MovingAdjustments,
) {
  return movingOrderAdjustedPricing(rows, adjustments, SERVICE_GROUP);
}
