import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOsloDateKey, parseIsoDate } from "@/lib/dates/isoDate";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

// A website order set to "needs change" (status rejected) that reaches its
// delivery date without the customer answering: staff get an alert and
// decide what to do — nothing is cancelled automatically. "Answering" is
// either "Be om endring" (which moves the order back to processing, so it
// isn't picked up here) or an email reply after the rejection.
//
// Run daily by app/api/cron/needs-change-alerts. One alert per rejection:
// an order rejected again later can be alerted again.

const KIND = "NEEDS_CHANGE_NO_REPLY";

type SweepOrder = {
  id: string;
  companyId: string;
  status: string | null;
  statusNotes: string | null;
  deliveryDate: string | null;
  timeWindow: string | null;
  rejectedAt: Date | null;
  lastInboundEmailAt: Date | null;
};

export function isAwaitingReplyOnDeliveryDay(
  order: Pick<SweepOrder, "status" | "deliveryDate" | "rejectedAt" | "lastInboundEmailAt">,
  todayKey: string,
): boolean {
  if (normalizeOrderStatus(order.status) !== "rejected") return false;
  const date = order.deliveryDate?.trim() ?? "";
  if (!parseIsoDate(date) || date > todayKey) return false;
  const replied =
    !!order.lastInboundEmailAt && (!order.rejectedAt || order.lastInboundEmailAt.getTime() > order.rejectedAt.getTime());
  return !replied;
}

export function buildNeedsChangeNoReplyAlert(order: Pick<SweepOrder, "statusNotes" | "deliveryDate" | "timeWindow" | "rejectedAt">) {
  return {
    title: "Needs change — no reply by the delivery date",
    message: [
      "The customer was asked to change this order and hasn't answered, and the delivery date has come.",
      `Delivery date: ${order.deliveryDate ?? "-"}${order.timeWindow ? ` (${order.timeWindow})` : ""}`,
      order.statusNotes?.trim() ? `What we asked them to change: ${order.statusNotes.trim()}` : null,
      "Contact the customer, then update the order — or decline it.",
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n"),
    payload: { kind: KIND, rejectedAt: order.rejectedAt ? order.rejectedAt.toISOString() : null },
  };
}

async function alreadyAlerted(order: SweepOrder): Promise<boolean> {
  const existing = await prisma.orderNotification.findMany({
    where: { orderId: order.id, companyId: order.companyId, type: "MANUAL_REVIEW" },
    select: { payload: true },
  });
  const rejectedAt = order.rejectedAt ? order.rejectedAt.toISOString() : null;
  return existing.some((notification) => {
    const payload = notification.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const { kind, rejectedAt: alertedFor } = payload as { kind?: unknown; rejectedAt?: unknown };
    return kind === KIND && (alertedFor ?? null) === rejectedAt;
  });
}

export type NeedsChangeNoReplySweepSummary = { scanned: number; created: number; skipped: number; failed: number };

export async function runNeedsChangeNoReplySweep(params?: { limit?: number }): Promise<NeedsChangeNoReplySweepSummary> {
  const todayKey = getOsloDateKey();

  const candidates: SweepOrder[] = await prisma.order.findMany({
    where: {
      isWebsiteOrder: true,
      gdprAnonymized: false,
      status: { in: ["rejected", "avvist"], mode: "insensitive" },
      // ISO dates compare as strings; isAwaitingReplyOnDeliveryDay drops
      // anything that isn't one.
      deliveryDate: { lte: todayKey },
    },
    select: {
      id: true,
      companyId: true,
      status: true,
      statusNotes: true,
      deliveryDate: true,
      timeWindow: true,
      rejectedAt: true,
      lastInboundEmailAt: true,
    },
    orderBy: { deliveryDate: "asc" },
    take: params?.limit,
  });

  const summary: NeedsChangeNoReplySweepSummary = { scanned: candidates.length, created: 0, skipped: 0, failed: 0 };

  for (const order of candidates) {
    try {
      if (!isAwaitingReplyOnDeliveryDay(order, todayKey) || (await alreadyAlerted(order))) {
        summary.skipped += 1;
        continue;
      }
      const alert = buildNeedsChangeNoReplyAlert(order);
      await createOrderNotification(prisma, {
        orderId: order.id,
        companyId: order.companyId,
        type: "MANUAL_REVIEW",
        title: alert.title,
        message: alert.message,
        payload: alert.payload as unknown as Prisma.InputJsonValue,
      });
      summary.created += 1;
    } catch (error) {
      summary.failed += 1;
      console.error("[needs-change-alerts] failed to create alert", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}
