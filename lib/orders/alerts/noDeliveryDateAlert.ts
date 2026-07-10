import { Prisma, type PrismaClient } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function buildNoDeliveryDateAlert() {
  return {
    title: "No delivery date",
    message:
      "Order was submitted without a delivery date. Set a delivery date before confirming.",
    payload: {
      kind: "NO_DELIVERY_DATE" as const,
    },
  };
}

async function hasNoDeliveryDateAlertEverExisted(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
  },
) {
  const existing = await prisma.orderNotification.findMany({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      type: "MANUAL_REVIEW",
    },
    select: {
      id: true,
      payload: true,
    },
  });

  return existing.some((notification) => {
    if (
      !notification.payload ||
      typeof notification.payload !== "object" ||
      Array.isArray(notification.payload)
    ) {
      return false;
    }

    return (
      (notification.payload as { kind?: unknown }).kind === "NO_DELIVERY_DATE"
    );
  });
}

export async function createNoDeliveryDateAlert(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    deliveryDate: string | null;
  },
) {
  if (input.deliveryDate) return null;

  const alreadyExists = await hasNoDeliveryDateAlertEverExisted(prisma, input);
  if (alreadyExists) return null;

  const alert = buildNoDeliveryDateAlert();

  return createOrderNotification(prisma, {
    orderId: input.orderId,
    companyId: input.companyId,
    type: "MANUAL_REVIEW",
    title: alert.title,
    message: alert.message,
    payload: alert.payload as unknown as Prisma.InputJsonValue,
  });
}
