import { Prisma, type PrismaClient } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

function isCreatedTodayForTomorrowDelivery(input: {
  createdAt: Date;
  deliveryDate: string;
}) {
  const createdDateKey = toDateKey(input.createdAt);
  const todayDateKey = toDateKey(new Date());
  const tomorrowDateKey = toDateKey(addDays(new Date(), 1));

  return (
    createdDateKey === todayDateKey && input.deliveryDate === tomorrowDateKey
  );
}

export function buildNextDayDeliveryAlert(input: {
  createdAt: Date;
  deliveryDate: string;
}) {
  return {
    title: "Next-day delivery warning",
    message: [
      "Order was created today with delivery scheduled for tomorrow.",
      `Created: ${toDateKey(input.createdAt)}`,
      `Delivery date: ${input.deliveryDate}`,
      "Review timing and capacity before confirming.",
    ].join("\n"),
    payload: {
      kind: "NEXT_DAY_DELIVERY" as const,
      createdDate: toDateKey(input.createdAt),
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
    createdAt: Date;
    deliveryDate: string;
  },
) {
  if (!isCreatedTodayForTomorrowDelivery(input)) return null;

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
