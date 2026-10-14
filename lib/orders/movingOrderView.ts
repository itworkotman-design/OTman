import { MOVING_PRODUCT_CODE, MOVING_SERVICES_PRODUCT_CODE } from "@/lib/content/movingCatalog";
import type { OrderExtraLine } from "./websiteBookingDetails";
import type { ProductGroup } from "./websiteOrderProducts";

// A move's price as stored on the order (Order.items, written by
// movingOrderItemRows), in the shapes the admin WebsiteOrderModal and the
// partner view already render: the move itself (size + services) as one
// product, the floor/carry surcharges and the km as order extras. Kroner,
// ex. VAT, each line rounded like movingOrderPricing rounds it — so the lines
// add up to the stored total.

export type MovingOrderItem = {
  productCode: string | null;
  optionCode: string | null;
  optionLabel: string | null;
  quantity: number;
  customerPriceCents: number | null;
  subcontractorPriceCents: number | null;
};

export type MovingOrderPriceView = {
  products: ProductGroup[];
  orderExtras: OrderExtraLine[];
  total: number;
};

export function isMovingOrderItems(items: Pick<MovingOrderItem, "productCode">[]): boolean {
  return items.some((item) => item.productCode === MOVING_PRODUCT_CODE);
}

export function movingOrderPriceView(items: MovingOrderItem[], side: "customer" | "partner"): MovingOrderPriceView {
  const lineKr = (item: MovingOrderItem) =>
    Math.round(((side === "customer" ? item.customerPriceCents : item.subcontractorPriceCents) ?? 0) * item.quantity / 100);
  const label = (item: MovingOrderItem) => item.optionLabel || item.optionCode || "";
  const isMove = (item: MovingOrderItem) =>
    item.productCode === MOVING_PRODUCT_CODE || item.productCode === MOVING_SERVICES_PRODUCT_CODE;

  const moveItems = items.filter(isMove).map((item) => ({ label: label(item), qty: item.quantity, price: lineKr(item) }));
  const orderExtras = items.filter((item) => !isMove(item)).map((item) => ({ label: label(item), qty: item.quantity, price: lineKr(item) }));
  const moveTotal = moveItems.reduce((sum, item) => sum + item.price, 0);

  return {
    products: moveItems.length > 0 ? [{ cardId: 0, productName: "Moving", total: moveTotal, items: moveItems }] : [],
    orderExtras,
    total: moveTotal + orderExtras.reduce((sum, line) => sum + line.price, 0),
  };
}
