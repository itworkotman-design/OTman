import { Prisma, type PrismaClient } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function buildSubcontractorPriceAlert(input: {
  customerPrice: number;
  subcontractorPrice: number;
}) {
  return {
    title: "Subcontractor price warning",
    message: [
      "Subcontractor price is higher than customer price.",
      `Customer price: ${input.customerPrice} NOK`,
      `Subcontractor price: ${input.subcontractorPrice} NOK`,
      "Review this order before confirming the pricing.",
    ].join("\n"),
    payload: {
      kind: "SUBCONTRACTOR_PRICE_WARNING" as const,
      customerPrice: input.customerPrice,
      subcontractorPrice: input.subcontractorPrice,
    },
  };
}

export async function hasSubcontractorPriceAlertEverExisted(
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

    return payload.kind === "SUBCONTRACTOR_PRICE_WARNING";
  });
}

export async function createSubcontractorPriceAlert(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    customerPrice: number;
    subcontractorPrice: number;
  },
) {
  if (
    !Number.isFinite(input.customerPrice) ||
    !Number.isFinite(input.subcontractorPrice)
  ) {
    return null;
  }

  if (input.subcontractorPrice <= input.customerPrice) return null;

  const alreadyExists = await hasSubcontractorPriceAlertEverExisted(prisma, input);
  if (alreadyExists) return null;

  const alert = buildSubcontractorPriceAlert({
    customerPrice: input.customerPrice,
    subcontractorPrice: input.subcontractorPrice,
  });

  return createOrderNotification(prisma, {
    orderId: input.orderId,
    companyId: input.companyId,
    type: "MANUAL_REVIEW",
    title: alert.title,
    message: alert.message,
    payload: alert.payload as unknown as Prisma.InputJsonValue,
  });
}
