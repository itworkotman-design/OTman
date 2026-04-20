import { Prisma, type PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type CreateOrderNotificationInput = {
  orderId: string;
  companyId: string;
  type: "MANUAL_REVIEW" | "GSM_REVIEW" | "CAPACITY_REVIEW";
  title: string;
  message: string;
  payload?: Prisma.InputJsonValue;
};

type ResolveOrderNotificationInput = {
  notificationId: string;
  orderId: string;
  companyId: string;
  resolvedByMembershipId: string;
};

export async function hasOpenCapacityNotification(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    deliveryDate: string;
    timeWindow: string;
  },
) {
  const existing = await prisma.orderNotification.findFirst({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      type: "CAPACITY_REVIEW",
      resolvedAt: null,
    },
    select: {
      id: true,
      payload: true,
    },
  });

  if (!existing || !existing.payload || typeof existing.payload !== "object") {
    return false;
  }

  const payload = existing.payload as {
    deliveryDate?: unknown;
    timeWindow?: unknown;
  };

  return (
    payload.deliveryDate === input.deliveryDate &&
    payload.timeWindow === input.timeWindow
  );
}

export async function createOrderNotification(
  prisma: PrismaLike,
  input: CreateOrderNotificationInput,
) {
  const notification = await prisma.orderNotification.create({
    data: {
      orderId: input.orderId,
      companyId: input.companyId,
      type: input.type,
      title: input.title,
      message: input.message,
      payload: input.payload ?? Prisma.JsonNull,
    },
  });

  const unreadNotificationCount = await prisma.orderNotification.count({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      resolvedAt: null,
    },
  });

  await prisma.order.update({
    where: {
      id: input.orderId,
    },
    data: {
      lastNotificationAt: notification.createdAt,
      needsNotificationAttention: unreadNotificationCount > 0,
      unreadNotificationCount,
    },
  });

  return notification;
}

export async function resolveOrderNotification(
  prisma: PrismaLike,
  input: ResolveOrderNotificationInput,
) {
  const result = await prisma.orderNotification.updateMany({
    where: {
      id: input.notificationId,
      orderId: input.orderId,
      companyId: input.companyId,
      resolvedAt: null,
    },
    data: {
      resolvedAt: new Date(),
      resolvedByMembershipId: input.resolvedByMembershipId,
    },
  });

  if (result.count === 0) {
    return false;
  }

  const unreadNotificationCount = await prisma.orderNotification.count({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      resolvedAt: null,
    },
  });

  await prisma.order.update({
    where: {
      id: input.orderId,
    },
    data: {
      needsNotificationAttention: unreadNotificationCount > 0,
      unreadNotificationCount,
    },
  });

  return true;
}

export async function resolveOutdatedCapacityNotifications(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    deliveryDate: string;
    timeWindow: string;
    resolvedByMembershipId?: string | null;
  },
) {
  const openNotifications = await prisma.orderNotification.findMany({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      type: "CAPACITY_REVIEW",
      resolvedAt: null,
    },
    select: {
      id: true,
      payload: true,
    },
  });

  const outdatedIds = openNotifications
    .filter((notification) => {
      if (
        !notification.payload ||
        typeof notification.payload !== "object" ||
        Array.isArray(notification.payload)
      ) {
        return true;
      }

      const payload = notification.payload as {
        deliveryDate?: unknown;
        timeWindow?: unknown;
      };

      return (
        payload.deliveryDate !== input.deliveryDate ||
        payload.timeWindow !== input.timeWindow
      );
    })
    .map((notification) => notification.id);

  if (outdatedIds.length === 0) {
    return 0;
  }

  const now = new Date();

  const result = await prisma.orderNotification.updateMany({
    where: {
      id: {
        in: outdatedIds,
      },
      resolvedAt: null,
    },
    data: {
      resolvedAt: now,
      resolvedByMembershipId: input.resolvedByMembershipId ?? null,
    },
  });

  const unreadNotificationCount = await prisma.orderNotification.count({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      resolvedAt: null,
    },
  });

  await prisma.order.update({
    where: {
      id: input.orderId,
    },
    data: {
      needsNotificationAttention: unreadNotificationCount > 0,
      unreadNotificationCount,
    },
  });

  return result.count;
}
