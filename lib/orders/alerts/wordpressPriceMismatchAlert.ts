import { Prisma } from "@prisma/client";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

function parseWordpressRawTotal(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeWordpressComparableTotal(value: number): number {
  return Math.abs(value);
}

function roundSqlMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function hasWordpressStoredTotalMismatch(params: {
  appPriceExVat: number;
  wordpressRawTotal: unknown;
}): boolean {
  const wordpressTotal = parseWordpressRawTotal(params.wordpressRawTotal);
  if (wordpressTotal === null) {
    return false;
  }

  const appTotal = roundSqlMoney(params.appPriceExVat);
  const wpTotal = roundSqlMoney(normalizeWordpressComparableTotal(wordpressTotal));
  const appTotalAsCents = roundSqlMoney(params.appPriceExVat * 100);

  return appTotal !== wpTotal && appTotalAsCents !== wpTotal;
}

export async function syncWordpressPriceMismatchAlert(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    companyId: string;
    appPriceExVat: number;
    wordpressRawTotal: unknown;
  },
) {
  const {
    orderId,
    companyId,
    appPriceExVat,
    wordpressRawTotal,
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

  const hasMismatch = hasWordpressStoredTotalMismatch({
    appPriceExVat,
    wordpressRawTotal,
  });

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

  const everExisted = await tx.orderNotification.findFirst({
    where: {
      orderId,
      companyId,
      type: "MANUAL_REVIEW",
      title: "WordPress price mismatch",
    },
    select: {
      id: true,
    },
  });

  if (everExisted) return;

  const parsedWordpressRawTotal = parseWordpressRawTotal(wordpressRawTotal);

  await createOrderNotification(tx, {
    orderId,
    companyId,
    type: "MANUAL_REVIEW",
    title: "WordPress price mismatch",
    message:
      "Stored order total does not match the imported WordPress total. Review the order manually.",
    payload: {
      source: "wordpress_import",
      appPriceExVat,
      wordpressRawTotal: parsedWordpressRawTotal,
      comparedWordpressTotal:
        parsedWordpressRawTotal === null
          ? null
          : normalizeWordpressComparableTotal(parsedWordpressRawTotal),
    },
  });
}
