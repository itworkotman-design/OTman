import { CUSTOM_DEVIATION_CODE, DEVIATION_FEE_OPTIONS } from "@/lib/booking/pricing/deviationFees";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import { MOVING_DEVIATION_ITEM_CODE, MOVING_EXPRESS_ITEM_CODE } from "@/lib/content/movingCatalog";
import { movingLineKey } from "./movingOrderCalculator";
import type { MovingOrderItem } from "./movingOrderView";
import { handlingFromOrder, type WebsiteOrderHandling } from "./websiteOrderHandling";

// Express delivery and the deviation fee on a move — set by an admin in
// "Handle order" (moving-details), never by the customer. Priced like a
// delivery's (buildCalculatorBreakdownsWithOrderExtras): from the moving
// price list's EXPRESS_DELIVERY and deviation settings, a custom deviation
// with its own prices and named by its description. Stored as the move's own
// order lines (Order.items), so the calculator, the partner view and the
// customer's page show them as order extras.
//
// They're priced when an admin sets them and carried over as they are when
// the move is re-priced (an edit, "Use new price", the customer's own change),
// so a later price-list change never moves a fee staff already agreed.

export type MovingHandlingRates = {
  expressDelivery: MovingCatalogOption;
  // labelEn = the DEVIATION_FEE_OPTIONS englishLabel (what Order.deviation holds).
  deviations: MovingCatalogOption[];
};

export type MovingHandlingLineFields = Pick<WebsiteOrderHandling, "expressDelivery" | "deviation" | "customDeviation">;

const CUSTOM_LABEL = DEVIATION_FEE_OPTIONS.find((o) => o.code === CUSTOM_DEVIATION_CODE)?.englishLabel ?? "Custom";

export function isMovingHandlingItem(item: Pick<MovingOrderItem, "productCode">): boolean {
  return item.productCode === MOVING_EXPRESS_ITEM_CODE || item.productCode === MOVING_DEVIATION_ITEM_CODE;
}

const cents = (kroner: number | null) => (kroner === null ? null : Math.round(kroner * 100));

// The move's express and deviation lines, in movingOrderItemRows' shape.
// Without rates (no moving price list settings) a deviation falls back to its
// built-in fee and express costs nothing.
export function movingHandlingItemRows(rates: MovingHandlingRates | null | undefined, handling: MovingHandlingLineFields) {
  const row = (productCode: string, productName: string, code: string, label: string, customerPriceCents: number, subcontractorPriceCents: number) => ({
    cardId: 0,
    productCode,
    productName,
    itemType: "product",
    optionCode: code,
    optionLabel: label,
    quantity: 1,
    customerPriceCents,
    subcontractorPriceCents,
  });
  const rows: ReturnType<typeof row>[] = [];

  if (handling.expressDelivery) {
    const express = rates?.expressDelivery;
    rows.push(
      row(
        MOVING_EXPRESS_ITEM_CODE,
        "Express delivery",
        express?.code ?? "EXPRESS_DELIVERY",
        express?.labelEn ?? "Express delivery",
        express?.customerPriceCents ?? 0,
        express?.subcontractorPriceCents ?? 0,
      ),
    );
  }

  const fee = DEVIATION_FEE_OPTIONS.find((option) => option.englishLabel === handling.deviation);
  if (fee) {
    const rate = rates?.deviations.find((option) => option.code === fee.code);
    const isCustom = fee.code === CUSTOM_DEVIATION_CODE;
    const customer = (isCustom ? cents(handling.customDeviation.price) : null) ?? rate?.customerPriceCents ?? fee.price * 100;
    const partner = (isCustom ? cents(handling.customDeviation.subcontractorPrice) : null) ?? rate?.subcontractorPriceCents ?? fee.subcontractorPrice * 100;
    const label = (isCustom ? handling.customDeviation.description?.trim() : "") || fee.englishLabel;
    rows.push(row(MOVING_DEVIATION_ITEM_CODE, "Deviation", fee.code, label, customer, partner));
  }

  return rows;
}

type StoredItem = MovingOrderItem & { cardId?: number | null; productName?: string | null; itemType?: string | null };

// The order's stored express/deviation lines as rows to write again — what a
// re-price carries over unchanged.
export function storedMovingHandlingRows(items: StoredItem[]): ReturnType<typeof movingHandlingItemRows> {
  return items.filter(isMovingHandlingItem).map((item) => ({
    cardId: item.cardId ?? 0,
    productCode: item.productCode ?? "",
    productName: item.productName ?? "",
    itemType: item.itemType ?? "product",
    optionCode: item.optionCode ?? "",
    optionLabel: item.optionLabel ?? "",
    quantity: item.quantity,
    customerPriceCents: item.customerPriceCents ?? 0,
    subcontractorPriceCents: item.subcontractorPriceCents ?? 0,
  }));
}

// Those lines for the customer's page ("My order"), keyed like movingLineKey,
// so its live price counts them (and any staff set to 0) like the server.
// The partner side is left out.
export function movingStaffLines(items: StoredItem[]) {
  return storedMovingHandlingRows(items).map((row) => ({
    key: movingLineKey(row),
    label: row.optionLabel,
    qty: row.quantity,
    customerPriceCents: row.customerPriceCents * row.quantity,
  }));
}

// Whether a save changes what these lines are.
export function movingHandlingLinesChanged(stored: MovingHandlingLineFields, next: MovingHandlingLineFields): boolean {
  return (
    stored.expressDelivery !== next.expressDelivery ||
    stored.deviation !== next.deviation ||
    JSON.stringify(stored.customDeviation) !== JSON.stringify(next.customDeviation)
  );
}

// The "Handle order" panel's values for a move: as a delivery's, except a
// custom deviation's prices and description, which live on its stored line
// (a re-priced move rebuilds the pricing snapshot a delivery keeps them on).
export function movingHandlingFromOrder(
  order: Parameters<typeof handlingFromOrder>[0] & { items: MovingOrderItem[] },
): WebsiteOrderHandling {
  const handling = handlingFromOrder(order);
  if (order.deviation !== CUSTOM_LABEL) return handling;
  const line = order.items.find((item) => item.productCode === MOVING_DEVIATION_ITEM_CODE);
  if (!line) return handling;
  const kroner = (value: number | null) => (value === null ? null : Math.round(value * line.quantity) / 100);
  return {
    ...handling,
    customDeviation: {
      price: kroner(line.customerPriceCents),
      subcontractorPrice: kroner(line.subcontractorPriceCents),
      description: line.optionLabel && line.optionLabel !== CUSTOM_LABEL ? line.optionLabel : null,
    },
  };
}
