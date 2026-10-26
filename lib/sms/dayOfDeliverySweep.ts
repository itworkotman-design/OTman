import { prisma } from "@/lib/db";
import { isSmsConfigured } from "@/lib/sms/gatewayApi";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import {
  AUTOMATIC_SMS_ORDER_SELECT,
  getOsloDateParts,
  loadEnabledTemplateBodies,
  sendAutomaticSmsToOrders,
  type AutomaticSmsCounts,
} from "@/lib/sms/automaticSms";

export { getOsloDateParts };

export const DAY_OF_DELIVERY_SMS_HOUR = 9;

// Orders in these (normalized) statuses never get the "we're coming today"
// text: not yet accepted, called off, or already done.
const CLOSED_STATUSES = new Set(["pending", "rejected", "cancelled", "canceled", "failed", "completed", "invoiced", "paid"]);

export type DayOfDeliverySmsSummary = AutomaticSmsCounts & {
  date: string;
  skippedReason?: "BEFORE_SEND_HOUR" | "NOT_CONFIGURED" | "NO_ENABLED_TEMPLATE";
};

// Run by the cron route. Safe to call repeatedly (e.g. hourly, or at both
// 07:00 and 08:00 UTC to cover DST): before 09:00 Oslo it does nothing, and
// each order is claimed via dayOfDeliverySmsSentAt before it is texted, so a
// customer gets the SMS once. Orders created later in the day for same-day
// delivery are picked up by the next run.
export async function runDayOfDeliverySmsSweep(params?: { now?: Date; limit?: number }): Promise<DayOfDeliverySmsSummary> {
  const now = params?.now ?? new Date();
  const { date, hour } = getOsloDateParts(now);
  const summary: DayOfDeliverySmsSummary = { date, scanned: 0, sent: 0, failed: 0, skipped: 0 };

  if (hour < DAY_OF_DELIVERY_SMS_HOUR) return { ...summary, skippedReason: "BEFORE_SEND_HOUR" };
  if (!isSmsConfigured()) return { ...summary, skippedReason: "NOT_CONFIGURED" };

  const templateByCompany = await loadEnabledTemplateBodies("DAY_OF_DELIVERY");
  if (templateByCompany.size === 0) return { ...summary, skippedReason: "NO_ENABLED_TEMPLATE" };

  const orders = await prisma.order.findMany({
    where: {
      companyId: { in: Array.from(templateByCompany.keys()) },
      deliveryDate: date,
      dayOfDeliverySmsSentAt: null,
      gdprAnonymized: false,
    },
    select: AUTOMATIC_SMS_ORDER_SELECT,
    orderBy: { createdAt: "asc" },
    take: params?.limit,
  });

  const counts = await sendAutomaticSmsToOrders({
    orders,
    templateByCompany,
    kind: "DAY_OF_DELIVERY",
    now,
    shouldSkip: (order) => CLOSED_STATUSES.has(normalizeOrderStatus(order.status)),
  });

  return { date, ...counts };
}
