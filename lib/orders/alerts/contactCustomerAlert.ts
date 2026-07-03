import { Prisma, type PrismaClient } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function buildContactCustomerAlert(input: {
  timeWindow: string;
  note: string;
}) {
  return {
    title: "Contact customer requested",
    message: [
      "The order creator checked contact customer for custom delivery time.",
      `Time window: ${input.timeWindow || "-"}`,
      input.note ? `Note: ${input.note}` : null,
      "Contact the customer before confirming delivery.",
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n"),
    payload: {
      kind: "CONTACT_CUSTOMER_CUSTOM_TIME" as const,
      timeWindow: input.timeWindow,
      note: input.note,
    },
  };
}

async function hasContactCustomerAlertEverExisted(
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
      (notification.payload as { kind?: unknown }).kind ===
      "CONTACT_CUSTOMER_CUSTOM_TIME"
    );
  });
}

export async function createContactCustomerAlert(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    contactCustomer: boolean;
    timeWindow: string;
    note: string;
  },
) {
  if (!input.contactCustomer) return null;

  const alreadyExists = await hasContactCustomerAlertEverExisted(prisma, input);
  if (alreadyExists) return null;

  const alert = buildContactCustomerAlert({
    timeWindow: input.timeWindow,
    note: input.note,
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
