import type { PrismaClient, Prisma } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const ORDER_SLOT_LIMIT = 15;

const EXCLUDED_CAPACITY_STATUSES = [
  "paid",
  "invoiced",
  "completed",
  "failed",
  "cancelled",
] as const;

function parseTimeToMinutes(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function parseTimeWindowRange(timeWindow: string) {
  const [rawStart = "", rawEnd = ""] = timeWindow.split("-");
  const start = parseTimeToMinutes(rawStart);
  const end = parseTimeToMinutes(rawEnd);

  if (start === null || end === null || end <= start) {
    return null;
  }

  return { start, end };
}

function timeWindowsOverlap(a: string, b: string) {
  const rangeA = parseTimeWindowRange(a);
  const rangeB = parseTimeWindowRange(b);

  if (!rangeA || !rangeB) {
    return a.trim() === b.trim();
  }

  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
}

export async function countOrdersInDeliverySlot(
  prisma: PrismaLike,
  input: {
    companyId: string;
    deliveryDate: string;
    timeWindow: string;
    excludeOrderId?: string;
  },
) {
  const orders = await prisma.order.findMany({
    where: {
      companyId: input.companyId,
      deliveryDate: input.deliveryDate,
      status: {
        notIn: [...EXCLUDED_CAPACITY_STATUSES],
      },
      ...(input.excludeOrderId
        ? {
            NOT: {
              id: input.excludeOrderId,
            },
          }
        : {}),
    },
    select: {
      id: true,
      timeWindow: true,
    },
  });

  return orders.filter((order) => {
    if (!order.timeWindow) {
      return false;
    }

    return timeWindowsOverlap(order.timeWindow, input.timeWindow);
  }).length;
}

export function isDeliverySlotOverCapacity(
  count: number,
  limit = ORDER_SLOT_LIMIT,
) {
  return count > limit;
}
