import { Prisma } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

export async function syncWordpressPriceMismatchAlert(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    companyId: string;
    wordpressPriceExVatCents?: number;
    nativePriceExVatCents: number;
  },
) {
  const {
    orderId,
    companyId,
    wordpressPriceExVatCents,
    nativePriceExVatCents,
  } = params;

  const existing = await tx.orderNotification.findFirst({
    where: {
      orderId,
      companyId,
      type: "MANUAL_REVIEW",
      title: "WordPress price mismatch",
      resolvedAt: null,
    },
    select: {
      id: true,
    },
  });

  const hasMismatch =
    typeof wordpressPriceExVatCents === "number" &&
    wordpressPriceExVatCents !== nativePriceExVatCents;

  if (!hasMismatch) {
    if (!existing) return;

    await tx.orderNotification.update({
      where: {
        id: existing.id,
      },
      data: {
        resolvedAt: new Date(),
      },
    });

    const unreadNotificationCount = await tx.orderNotification.count({
      where: {
        orderId,
        companyId,
        resolvedAt: null,
      },
    });

    await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        needsNotificationAttention: unreadNotificationCount > 0,
        unreadNotificationCount,
      },
    });

    return;
  }

  if (existing) return;

  await createOrderNotification(tx, {
    orderId,
    companyId,
    type: "MANUAL_REVIEW",
    title: "WordPress price mismatch",
    message:
      "Imported WordPress price does not match the rebuilt native total. Review the order manually.",
    payload: {
      source: "wordpress_import",
      wordpressPriceExVatCents,
      nativePriceExVatCents,
    },
  });
}
