import { Prisma, type PrismaClient } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function buildNoSubcontractorAlert() {
  return {
    title: "No subcontractor selected",
    message:
      "Order was marked as completed without a subcontractor assigned. Assign a subcontractor before finalising.",
    payload: {
      kind: "NO_SUBCONTRACTOR_ON_COMPLETE" as const,
    },
  };
}

async function hasOpenNoSubcontractorAlert(
  prisma: PrismaLike,
  input: { orderId: string; companyId: string },
) {
  const existing = await prisma.orderNotification.findMany({
    where: {
      orderId: input.orderId,
      companyId: input.companyId,
      type: "MANUAL_REVIEW",
      resolvedAt: null,
    },
    select: { id: true, payload: true },
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
    return payload.kind === "NO_SUBCONTRACTOR_ON_COMPLETE";
  });
}

export async function createNoSubcontractorAlert(
  prisma: PrismaLike,
  input: { orderId: string; companyId: string },
) {
  const alreadyExists = await hasOpenNoSubcontractorAlert(prisma, input);
  if (alreadyExists) return null;

  const alert = buildNoSubcontractorAlert();

  return createOrderNotification(prisma, {
    orderId: input.orderId,
    companyId: input.companyId,
    type: "MANUAL_REVIEW",
    title: alert.title,
    message: alert.message,
    payload: alert.payload as unknown as Prisma.InputJsonValue,
  });
}
