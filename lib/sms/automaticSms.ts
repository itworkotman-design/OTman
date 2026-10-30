import { prisma } from "@/lib/db";
import { sendOrderSms } from "@/lib/sms/sendOrderSms";
import { renderOrderSms, type AutomaticSmsKind, type SmsOrderFields } from "@/lib/sms/templates";
import { ORDER_SMS_SELECT } from "@/lib/sms/orderSmsFields";

// Shared by the cron sweeps that send AUTOMATIC_SMS_TEMPLATE_DEFAULTS kinds.

export const AUTOMATIC_SMS_ORDER_SELECT = { ...ORDER_SMS_SELECT, status: true } as const;

export type AutomaticSmsOrder = SmsOrderFields & {
  id: string;
  companyId: string;
  status: string | null;
  phone: string | null;
  phoneTwo: string | null;
};

export type AutomaticSmsCounts = {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
};

// Order.deliveryDate is a plain "YYYY-MM-DD" in Norwegian local time, and the
// server (Render) runs in UTC, so dates and send hours must be computed in
// Europe/Oslo explicitly.
export function getOsloDateParts(now: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

// Oslo's UTC offset (ms) at a given instant.
function getOsloOffsetMs(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// The UTC instant of 00:00 Oslo time on `now`'s Oslo date. The offset is
// re-read at the candidate midnight because it differs from `now`'s on the
// two DST-switch days.
export function getOsloStartOfDay(now: Date): Date {
  const [year, month, day] = getOsloDateParts(now).date.split("-").map(Number);
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  const candidate = new Date(midnightAsUtc - getOsloOffsetMs(now));
  return new Date(midnightAsUtc - getOsloOffsetMs(candidate));
}

// companyId → template body, for companies that have switched this kind on.
export async function loadEnabledTemplateBodies(kind: AutomaticSmsKind) {
  const templates = await prisma.smsTemplate.findMany({
    where: { kind, enabled: true },
    select: { companyId: true, body: true },
  });
  return new Map(templates.map((template) => [template.companyId, template.body]));
}

function claimOrder(orderId: string, kind: AutomaticSmsKind, now: Date) {
  return kind === "DAY_BEFORE_DELIVERY"
    ? prisma.order.updateMany({
        where: { id: orderId, dayBeforeDeliverySmsSentAt: null },
        data: { dayBeforeDeliverySmsSentAt: now },
      })
    : prisma.order.updateMany({
        where: { id: orderId, reviewSmsSentAt: null },
        data: { reviewSmsSentAt: now },
      });
}

// Each order is claimed (its sent-at column set) before it is texted, so
// repeated or parallel cron runs never send the same automatic SMS twice. A
// claimed order whose send fails is not retried — the failure is visible in
// the order's SMS tab.
export async function sendAutomaticSmsToOrders(params: {
  orders: AutomaticSmsOrder[];
  templateByCompany: Map<string, string>;
  kind: AutomaticSmsKind;
  now: Date;
  shouldSkip?: (order: AutomaticSmsOrder) => boolean;
}): Promise<AutomaticSmsCounts> {
  const { orders, templateByCompany, kind, now, shouldSkip } = params;
  const counts: AutomaticSmsCounts = { scanned: orders.length, sent: 0, failed: 0, skipped: 0 };

  for (const order of orders) {
    const toPhone = order.phone?.trim() || order.phoneTwo?.trim() || "";
    const templateBody = templateByCompany.get(order.companyId);

    if (!toPhone || !templateBody || shouldSkip?.(order)) {
      counts.skipped += 1;
      continue;
    }

    try {
      const claim = await claimOrder(order.id, kind, now);
      if (claim.count === 0) {
        counts.skipped += 1;
        continue;
      }

      const result = await sendOrderSms({
        order: { id: order.id, companyId: order.companyId },
        toPhone,
        body: renderOrderSms(templateBody, order),
        kind,
        actor: { name: "Automatic SMS", source: "SYSTEM" },
      });

      if (result.ok) counts.sent += 1;
      else counts.failed += 1;
    } catch (error) {
      counts.failed += 1;
      console.error(`[automatic-sms:${kind}] failed to send`, {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return counts;
}
