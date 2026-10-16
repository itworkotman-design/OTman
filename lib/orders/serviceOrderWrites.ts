import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SERVICE_ITEM_PRODUCT_CODES } from "./serviceOrderCalculator";

type ServiceItemRow = Omit<Prisma.OrderItemCreateManyInput, "orderId">;

// A service request's lines (the quote, express, deviation) replaced in one
// transaction: its old lines out, `itemRows` in, the order's fields (`data`)
// updated — shared by the admin edit (service-details) and "My order".
export function serviceOrderItemWrites(orderId: string, itemRows: ServiceItemRow[], data: Prisma.OrderUpdateInput) {
  return [
    prisma.orderItem.deleteMany({ where: { orderId, productCode: { in: SERVICE_ITEM_PRODUCT_CODES } } }),
    prisma.orderItem.createMany({ data: itemRows.map((row) => ({ ...row, orderId })) }),
    prisma.order.update({ where: { id: orderId }, data }),
  ];
}
