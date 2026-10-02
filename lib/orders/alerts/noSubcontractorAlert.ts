import { Prisma, type PrismaClient } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type NoSubcontractorAlertOptions = {
  // Normalized order status the order sits in (e.g. "invoiced"). Defaults to
  // "completed" — the original on-complete trigger.
  status?: string;
  // True when raised by the daily missing-partner cron rather than the
  // status change itself.
  overdue?: boolean;
};

export function buildNoSubcontractorAlert(options: NoSubcontractorAlertOptions = {}) {
  const status = options.status || "completed";

  return {
    title: "No subcontractor selected",
    message: options.overdue
      ? `Order has been marked as ${status} for more than a day without a subcontractor assigned. Assign a subcontractor before finalising.`
      : `Order was marked as ${status} without a subcontractor assigned. Assign a subcontractor before finalising.`,
    payload: {
      kind: "NO_SUBCONTRACTOR_ON_COMPLETE" as const,
      status,
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

// Dedup only looks at *open* alerts, so once an admin resolves one the daily
// cron raises it again until a partner is actually set.
export async function createNoSubcontractorAlert(
  prisma: PrismaLike,
  input: { orderId: string; companyId: string } & NoSubcontractorAlertOptions,
) {
  const alreadyExists = await hasOpenNoSubcontractorAlert(prisma, input);
  if (alreadyExists) return null;

  const alert = buildNoSubcontractorAlert(input);

  return createOrderNotification(prisma, {
    orderId: input.orderId,
    companyId: input.companyId,
    type: "MANUAL_REVIEW",
    title: alert.title,
    message: alert.message,
    payload: alert.payload as unknown as Prisma.InputJsonValue,
  });
}
