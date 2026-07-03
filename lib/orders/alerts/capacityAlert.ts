import { Prisma, type PrismaClient } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function buildCapacityAlert(input: {
  deliveryDate: string;
  timeWindow: string;
  count: number;
  limit: number;
}) {
  return {
    title: "Capacity warning",
    message: [
      "Selected time window is full.",
      `Delivery date: ${input.deliveryDate}`,
      `Time window: ${input.timeWindow}`,
      `Orders in slot: ${input.count}`,
      `Limit: ${input.limit}`,
      "This order may need to be moved to another time window on the same day.",
    ].join("\n"),
    payload: {
      kind: "CAPACITY_WARNING" as const,
      deliveryDate: input.deliveryDate,
      timeWindow: input.timeWindow,
      count: input.count,
      limit: input.limit,
    },
  };
}

export async function hasCapacityAlertEverExisted(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
  },
) {
  const existing = await prisma.orderNotification.findFirst({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      type: "CAPACITY_REVIEW",
    },
    select: {
      id: true,
      payload: true,
    },
  });

  if (!existing || !existing.payload || typeof existing.payload !== "object") {
    return false;
  }

  const payload = existing.payload as { kind?: unknown };

  return payload.kind === "CAPACITY_WARNING";
}

export async function createCapacityAlert(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    deliveryDate: string;
    timeWindow: string;
    count: number;
    limit: number;
    overCapacity: boolean;
  },
) {
  if (!input.overCapacity) return null;

  const alreadyExists = await hasCapacityAlertEverExisted(prisma, input);
  if (alreadyExists) return null;

  const alert = buildCapacityAlert(input);

  return createOrderNotification(prisma, {
    orderId: input.orderId,
    companyId: input.companyId,
    type: "CAPACITY_REVIEW",
    title: alert.title,
    message: alert.message,
    payload: alert.payload as unknown as Prisma.InputJsonValue,
  });
}
