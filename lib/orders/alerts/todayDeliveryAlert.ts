import { Prisma, type PrismaClient } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

function formatTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDeliveryToday(deliveryDate: string): boolean {
  return deliveryDate === formatTodayDateString();
}

export function buildTodayDeliveryAlert(input: {
  deliveryDate: string;
  timeWindow?: string | null;
}) {
  return {
    title: "Today delivery warning",
    message: [
      "Delivery is scheduled for today.",
      `Delivery date: ${input.deliveryDate}${input.timeWindow ? ` (${input.timeWindow})` : ""}`,
      "Review timing and capacity before confirming.",
    ].join("\n"),
    payload: {
      kind: "TODAY_DELIVERY" as const,
      deliveryDate: input.deliveryDate,
    },
  };
}

async function hasTodayDeliveryAlertEverExisted(
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

    const payload = notification.payload as { kind?: unknown };

    return payload.kind === "TODAY_DELIVERY";
  });
}

export async function createTodayDeliveryAlert(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    deliveryDate: string;
    timeWindow?: string | null;
  },
) {
  if (!isDeliveryToday(input.deliveryDate)) return null;

  const alreadyExists = await hasTodayDeliveryAlertEverExisted(prisma, input);
  if (alreadyExists) return null;

  const alert = buildTodayDeliveryAlert(input);

  return createOrderNotification(prisma, {
    orderId: input.orderId,
    companyId: input.companyId,
    type: "MANUAL_REVIEW",
    title: alert.title,
    message: alert.message,
    payload: alert.payload as unknown as Prisma.InputJsonValue,
  });
}
