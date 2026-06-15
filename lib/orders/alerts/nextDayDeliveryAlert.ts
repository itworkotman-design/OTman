import { Prisma, type PrismaClient } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

function parseTimeWindowStartHour(timeWindow: string | null | undefined): number {
  if (!timeWindow) return 0;
  const match = timeWindow.match(/^(\d{1,2})/);
  return match ? Number(match[1]) : 0;
}

function isDeliveryWithin24Hours(deliveryDate: string, timeWindow?: string | null): boolean {
  const parts = deliveryDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return false;
  const startHour = parseTimeWindowStartHour(timeWindow);
  const deliveryStart = new Date(
    Number(parts[1]),
    Number(parts[2]) - 1,
    Number(parts[3]),
    startHour,
    0, 0, 0,
  );
  const diffMs = deliveryStart.getTime() - Date.now();
  return diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000;
}

export function buildNextDayDeliveryAlert(input: {
  deliveryDate: string;
  timeWindow?: string | null;
}) {
  return {
    title: "Next-day delivery warning",
    message: [
      "Delivery is scheduled within 24 hours.",
      `Delivery date: ${input.deliveryDate}${input.timeWindow ? ` (${input.timeWindow})` : ""}`,
      "Review timing and capacity before confirming.",
    ].join("\n"),
    payload: {
      kind: "NEXT_DAY_DELIVERY" as const,
      deliveryDate: input.deliveryDate,
    },
  };
}

async function hasOpenNextDayDeliveryAlert(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    deliveryDate: string;
  },
) {
  const existing = await prisma.orderNotification.findMany({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      type: "MANUAL_REVIEW",
      resolvedAt: null,
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

    const payload = notification.payload as {
      kind?: unknown;
      deliveryDate?: unknown;
    };

    return (
      payload.kind === "NEXT_DAY_DELIVERY" &&
      payload.deliveryDate === input.deliveryDate
    );
  });
}

export async function createNextDayDeliveryAlert(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    deliveryDate: string;
    timeWindow?: string | null;
  },
) {
  if (!isDeliveryWithin24Hours(input.deliveryDate, input.timeWindow)) return null;

  const alreadyExists = await hasOpenNextDayDeliveryAlert(prisma, input);
  if (alreadyExists) return null;

  const alert = buildNextDayDeliveryAlert(input);

  return createOrderNotification(prisma, {
    orderId: input.orderId,
    companyId: input.companyId,
    type: "MANUAL_REVIEW",
    title: alert.title,
    message: alert.message,
    payload: alert.payload as unknown as Prisma.InputJsonValue,
  });
}
