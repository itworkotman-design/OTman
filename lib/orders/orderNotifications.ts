import { Prisma, type PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type CreateOrderNotificationInput = {
  orderId: string;
  companyId: string;
  type: "MANUAL_REVIEW" | "GSM_REVIEW" | "CAPACITY_REVIEW" | "CUSTOM";
  title: string;
  message: string;
  payload?: Prisma.InputJsonValue;
  scheduledFor?: Date | null;
};

type ResolveOrderNotificationInput = {
  notificationId: string;
  orderId: string;
  companyId: string;
  resolvedByMembershipId: string;
};

type UpdateCustomOrderNotificationInput = {
  notificationId: string;
  orderId: string;
  companyId: string;
  title: string;
  message: string;
  scheduledFor: Date | null;
};

type DeleteCustomOrderNotificationInput = {
  notificationId: string;
  orderId: string;
  companyId: string;
};

function dueUnresolvedNotificationsWhere(
  orderId: string,
  companyId: string,
): Prisma.OrderNotificationWhereInput {
  return {
    orderId,
    companyId,
    resolvedAt: null,
    OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
  };
}

async function refreshOrderNotificationAttention(
  prisma: PrismaLike,
  input: { orderId: string; companyId: string },
) {
  const unreadNotificationCount = await prisma.orderNotification.count({
    where: dueUnresolvedNotificationsWhere(input.orderId, input.companyId),
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

  return unreadNotificationCount;
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
      scheduledFor: input.scheduledFor ?? null,
    },
  });

  await refreshOrderNotificationAttention(prisma, input);

  await prisma.order.update({
    where: {
      id: input.orderId,
    },
    data: {
      lastNotificationAt: notification.createdAt,
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

  await refreshOrderNotificationAttention(prisma, input);

  return true;
}

export async function updateCustomOrderNotification(
  prisma: PrismaLike,
  input: UpdateCustomOrderNotificationInput,
) {
  const result = await prisma.orderNotification.updateMany({
    where: {
      id: input.notificationId,
      orderId: input.orderId,
      companyId: input.companyId,
      type: "CUSTOM",
    },
    data: {
      title: input.title,
      message: input.message,
      scheduledFor: input.scheduledFor,
    },
  });

  if (result.count === 0) {
    return false;
  }

  await refreshOrderNotificationAttention(prisma, input);

  return true;
}

export async function deleteCustomOrderNotification(
  prisma: PrismaLike,
  input: DeleteCustomOrderNotificationInput,
) {
  const result = await prisma.orderNotification.deleteMany({
    where: {
      id: input.notificationId,
      orderId: input.orderId,
      companyId: input.companyId,
      type: "CUSTOM",
    },
  });

  if (result.count === 0) {
    return false;
  }

  await refreshOrderNotificationAttention(prisma, input);

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

  await refreshOrderNotificationAttention(prisma, input);

  return result.count;
}

export async function resolveAllOrderNotifications(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    resolvedByMembershipId?: string | null;
  },
) {
  const result = await prisma.orderNotification.updateMany({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      resolvedAt: null,
    },
    data: {
      resolvedAt: new Date(),
      resolvedByMembershipId: input.resolvedByMembershipId ?? null,
    },
  });

  if (result.count > 0) {
    await prisma.order.update({
      where: { id: input.orderId },
      data: {
        needsNotificationAttention: false,
        unreadNotificationCount: 0,
      },
    });
  }

  return result.count;
}
