import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  MOVING_CARRY_SURCHARGE_PRODUCT_CODE,
  MOVING_DISTANCE_ITEM_CODE,
  MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
  MOVING_PRODUCT_CODE,
  MOVING_SERVICES_PRODUCT_CODE,
} from "@/lib/content/movingCatalog";
import type { movingOrderSaveData } from "./movingOrderEdit";

// Every order line a move writes (movingOrderItemRows) — what a re-priced save replaces.
export const MOVING_ITEM_PRODUCT_CODES = [
  MOVING_PRODUCT_CODE,
  MOVING_SERVICES_PRODUCT_CODE,
  MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
  MOVING_CARRY_SURCHARGE_PRODUCT_CODE,
  MOVING_DISTANCE_ITEM_CODE,
];

// A re-priced move saved in one transaction: its old lines out, the new ones
// in, the order's fields (plus `extra`, e.g. contact or schedule) updated.
export function movingOrderSaveWrites(
  orderId: string,
  save: ReturnType<typeof movingOrderSaveData>,
  extra: Prisma.OrderUpdateInput = {},
) {
  return [
    prisma.orderItem.deleteMany({ where: { orderId, productCode: { in: MOVING_ITEM_PRODUCT_CODES } } }),
    prisma.orderItem.createMany({ data: save.itemRows.map((row) => ({ ...row, orderId })) }),
    prisma.order.update({ where: { id: orderId }, data: { ...save.orderData, ...extra } }),
  ];
}
