import { Prisma, type PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type CreateOrderNotificationInput = {
  orderId: string;
  companyId: string;
  type: "MANUAL_REVIEW" | "GSM_REVIEW";
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
