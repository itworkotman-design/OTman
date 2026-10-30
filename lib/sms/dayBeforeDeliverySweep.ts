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

// Oslo-time window for texting tomorrow's customers: from 19:00, and never
// from 22:00 on, so a late or repeated run doesn't text anyone at night.
export const DAY_BEFORE_DELIVERY_SMS_HOUR = 19;
export const DAY_BEFORE_DELIVERY_SMS_END_HOUR = 22;

// Orders in these (normalized) statuses never get the "we're coming tomorrow"
// text: not yet accepted (pending, or processing — a new homepage order nobody
// has confirmed yet; dashboard and homepage orders follow the same rule),
// called off, or already done.
const CLOSED_STATUSES = new Set(["pending", "processing", "rejected", "cancelled", "canceled", "failed", "completed", "invoiced", "paid"]);

export type DayBeforeDeliverySmsSummary = AutomaticSmsCounts & {
  // The delivery date being texted (tomorrow in Oslo).
  date: string;
  skippedReason?: "BEFORE_SEND_HOUR" | "AFTER_SEND_HOUR" | "NOT_CONFIGURED" | "NO_ENABLED_TEMPLATE";
};

// "2026-10-31" → "2026-11-01". Pure calendar arithmetic, so DST can't shift it.
function nextDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

// Run by the cron route. Safe to call repeatedly (e.g. at both 17:00 and
// 18:00 UTC to cover DST): outside 19:00–22:00 Oslo it does nothing, and each
// order is claimed via dayBeforeDeliverySmsSentAt before it is texted, so a
// customer gets the SMS once. Orders for tomorrow created after 19:00 are
// picked up by the next run inside the window.
export async function runDayBeforeDeliverySmsSweep(params?: { now?: Date; limit?: number }): Promise<DayBeforeDeliverySmsSummary> {
  const now = params?.now ?? new Date();
  const { date: today, hour } = getOsloDateParts(now);
  const date = nextDate(today);
  const summary: DayBeforeDeliverySmsSummary = { date, scanned: 0, sent: 0, failed: 0, skipped: 0 };

  if (hour < DAY_BEFORE_DELIVERY_SMS_HOUR) return { ...summary, skippedReason: "BEFORE_SEND_HOUR" };
  if (hour >= DAY_BEFORE_DELIVERY_SMS_END_HOUR) return { ...summary, skippedReason: "AFTER_SEND_HOUR" };
  if (!isSmsConfigured()) return { ...summary, skippedReason: "NOT_CONFIGURED" };

  const templateByCompany = await loadEnabledTemplateBodies("DAY_BEFORE_DELIVERY");
  if (templateByCompany.size === 0) return { ...summary, skippedReason: "NO_ENABLED_TEMPLATE" };

  const orders = await prisma.order.findMany({
    where: {
      companyId: { in: Array.from(templateByCompany.keys()) },
      deliveryDate: date,
      dayBeforeDeliverySmsSentAt: null,
      gdprAnonymized: false,
    },
    select: AUTOMATIC_SMS_ORDER_SELECT,
    orderBy: { createdAt: "asc" },
    take: params?.limit,
  });

  const counts = await sendAutomaticSmsToOrders({
    orders,
    templateByCompany,
    kind: "DAY_BEFORE_DELIVERY",
    now,
    shouldSkip: (order) => CLOSED_STATUSES.has(normalizeOrderStatus(order.status)),
  });

  return { date, ...counts };
}
