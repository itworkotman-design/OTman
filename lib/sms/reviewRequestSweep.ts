import { prisma } from "@/lib/db";
import { isSmsConfigured } from "@/lib/sms/gatewayApi";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import {
  AUTOMATIC_SMS_ORDER_SELECT,
  getOsloDateParts,
  getOsloStartOfDay,
  loadEnabledTemplateBodies,
  sendAutomaticSmsToOrders,
  type AutomaticSmsCounts,
} from "@/lib/sms/automaticSms";

// Customers are only texted between these Oslo hours. The SMS is only sent on
// the Oslo day the order was completed, so an order completed after 22:00 (or
// one a run never reached that day) gets no review request.
export const REVIEW_SMS_FIRST_HOUR = 9;
export const REVIEW_SMS_END_HOUR = 22;

const DAY_MS = 24 * 60 * 60 * 1000;
// Guards against a late GSM webhook completing a long-ago delivery: it gets a
// fresh gsmCompletedAt but shouldn't trigger a review ask.
const DELIVERED_WITHIN_DAYS = 7;

// Raw status values (canonical + legacy Norwegian) that normalize to
// "completed". Matched case-insensitively.
const COMPLETED_RAW_STATUSES = ["completed", "ferdig"];

export type ReviewRequestSmsSummary = AutomaticSmsCounts & {
  skippedReason?: "OUTSIDE_SEND_HOURS" | "NOT_CONFIGURED" | "NO_ENABLED_TEMPLATE";
};

// Run by the cron route every ~15 minutes. Only GSM auto-completions trigger
// it (Order.gsmCompletedAt, set solely by the GSM webhook); manual and bulk
// status changes never do. The order must still be "completed" when the run
// sees it — one moved back, or on to invoiced/paid, is not texted.
export async function runReviewRequestSmsSweep(params?: { now?: Date; limit?: number }): Promise<ReviewRequestSmsSummary> {
  const now = params?.now ?? new Date();
  const empty: ReviewRequestSmsSummary = { scanned: 0, sent: 0, failed: 0, skipped: 0 };

  const { hour } = getOsloDateParts(now);
  if (hour < REVIEW_SMS_FIRST_HOUR || hour >= REVIEW_SMS_END_HOUR) return { ...empty, skippedReason: "OUTSIDE_SEND_HOURS" };
  if (!isSmsConfigured()) return { ...empty, skippedReason: "NOT_CONFIGURED" };

  const templateByCompany = await loadEnabledTemplateBodies("REVIEW_REQUEST");
  if (templateByCompany.size === 0) return { ...empty, skippedReason: "NO_ENABLED_TEMPLATE" };

  const earliestDeliveryDate = getOsloDateParts(new Date(now.getTime() - DELIVERED_WITHIN_DAYS * DAY_MS)).date;

  const orders = await prisma.order.findMany({
    where: {
      companyId: { in: Array.from(templateByCompany.keys()) },
      status: { in: COMPLETED_RAW_STATUSES, mode: "insensitive" },
      // Completed by GSM today (Oslo) only — never manual completions, never old orders.
      gsmCompletedAt: { gte: getOsloStartOfDay(now) },
      deliveryDate: { gte: earliestDeliveryDate },
      reviewSmsSentAt: null,
      gdprAnonymized: false,
    },
    select: AUTOMATIC_SMS_ORDER_SELECT,
    orderBy: { gsmCompletedAt: "asc" },
    take: params?.limit,
  });

  return sendAutomaticSmsToOrders({
    orders,
    templateByCompany,
    kind: "REVIEW_REQUEST",
    now,
    shouldSkip: (order) => normalizeOrderStatus(order.status) !== "completed",
  });
}
