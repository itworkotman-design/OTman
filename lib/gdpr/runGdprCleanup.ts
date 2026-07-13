import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { deleteAttachmentFile } from "@/lib/orders/orderAttachmentStorage";

const ANONYMIZE_AFTER_DAYS = 30;
const POD_RETENTION_MONTHS = 6;

// Only the private end client's fields — B2B pickup/return/store contact
// fields (pickupAddress, extraPickupAddress, extraPickupContacts,
// returnAddress, cashierName, cashierPhone, customerLabel) are deliberately
// excluded, they identify the business location/contact, not the customer.
const ANONYMIZED_ORDER_FIELDS = [
  "customerName",
  "phone",
  "phoneTwo",
  "email",
  "deliveryAddress",
  "customerComments",
  "floorNo",
  "lift",
  "customTimeContactNote",
] as const;

const REDACTED_EMAIL_PLACEHOLDER = "gdpr-anonymized@deleted.invalid";
const REDACTED_MESSAGE_BODY = "[GDPR: message content anonymized]";
const REDACTED_SUBJECT = "[GDPR: subject anonymized]";

export type GdprCleanupSummary = {
  anonymized: number;
  podCleaned: number;
  failed: number;
};

type OrderCandidate = {
  id: string;
  companyId: string;
  status: string | null;
};

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function monthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

// Shared by both the cron route and the manual "run now" route so a caller
// can bound how many orders a single invocation processes (e.g. to work
// through a large backlog in controlled batches instead of one huge run).
export function parseGdprLimitParam(searchParams: URLSearchParams): number | undefined {
  const raw = searchParams.get("limit");
  if (!raw) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

async function anonymizeOrder(
  order: OrderCandidate & { legacyWordpressOrderId: number | null },
): Promise<void> {
  const [emailMessages, gsmTasks] = await Promise.all([
    prisma.orderEmailMessage.updateMany({
      where: { orderId: order.id },
      data: {
        subject: REDACTED_SUBJECT,
        bodyText: REDACTED_MESSAGE_BODY,
        bodyHtml: null,
        fromName: null,
        toName: null,
        fromEmail: REDACTED_EMAIL_PLACEHOLDER,
        toEmail: REDACTED_EMAIL_PLACEHOLDER,
      },
    }),
    prisma.orderGsmTask.updateMany({
      where: { orderId: order.id },
      data: { address: null },
    }),
  ]);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      customerName: null,
      phone: null,
      phoneTwo: null,
      email: null,
      deliveryAddress: null,
      customerComments: null,
      floorNo: null,
      lift: null,
      customTimeContactNote: null,
      legacyWordpressRawMeta: order.legacyWordpressOrderId ? Prisma.DbNull : undefined,
      gdprAnonymized: true,
      gdprDeletedAt: new Date(),
    },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      companyId: order.companyId,
      type: "GDPR_ANONYMIZED",
      actorMembershipId: null,
      payload: {
        fields: [...ANONYMIZED_ORDER_FIELDS],
        trigger: "paid_30d",
        relatedCleared: {
          emailMessages: emailMessages.count,
          gsmTasks: gsmTasks.count,
          legacyRawMeta: Boolean(order.legacyWordpressOrderId),
        },
      },
    },
  });
}

async function cleanupOrderPod(order: OrderCandidate): Promise<void> {
  const attachments = await prisma.orderAttachment.findMany({
    where: { orderId: order.id, source: "GSM" },
    select: { id: true, storagePath: true },
  });

  if (attachments.length === 0) return;

  for (const attachment of attachments) {
    await deleteAttachmentFile(attachment.storagePath);
  }

  await prisma.orderAttachment.deleteMany({
    where: { id: { in: attachments.map((attachment) => attachment.id) } },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      companyId: order.companyId,
      type: "GDPR_POD_DELETED",
      actorMembershipId: null,
      payload: {
        attachmentCount: attachments.length,
        trigger: "paid_180d",
      },
    },
  });
}

// Runs the two GDPR retention sweeps described in the Norway retention spec:
// anonymize the private client's PII 30 days after an order is marked Paid,
// and delete GSM proof-of-delivery files 6 months after Paid. `gdprHold`
// pauses both for a given order. Called both by the daily cron
// (no companyId — every company) and the dashboard "run now" button
// (companyId scoped to the caller's active company).
//
// `limit` caps how many orders each sweep processes per call (oldest
// paidAt first), so a large backlog (e.g. after a bulk status-correction
// script) can be worked through in controlled batches instead of one
// single run trying to touch everything at once.
export async function runGdprCleanup(
  options: { companyId?: string; limit?: number } = {},
): Promise<GdprCleanupSummary> {
  const summary: GdprCleanupSummary = { anonymized: 0, podCleaned: 0, failed: 0 };

  const anonymizeCandidates = await prisma.order.findMany({
    where: {
      paidAt: { not: null, lte: daysAgo(ANONYMIZE_AFTER_DAYS) },
      gdprHold: false,
      gdprAnonymized: false,
      ...(options.companyId ? { companyId: options.companyId } : {}),
    },
    select: { id: true, companyId: true, status: true, legacyWordpressOrderId: true },
    orderBy: { paidAt: "asc" },
    ...(options.limit ? { take: options.limit } : {}),
  });

  for (const order of anonymizeCandidates) {
    // paidAt only reflects the order having been Paid at some point — a
    // status query can't safely sit in the same DB filter because raw
    // status strings aren't fully normalized in storage, so the definitive
    // "is it Paid right now" check happens here in application code.
    if (normalizeOrderStatus(order.status) !== "paid") continue;

    try {
      await anonymizeOrder(order);
      summary.anonymized += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(
        `[gdpr-cleanup] failed to anonymize order ${order.id}:`,
        toErrorMessage(error),
      );
    }
  }

  const podCandidates = await prisma.order.findMany({
    where: {
      paidAt: { not: null, lte: monthsAgo(POD_RETENTION_MONTHS) },
      gdprHold: false,
      orderAttachments: { some: { source: "GSM" } },
      ...(options.companyId ? { companyId: options.companyId } : {}),
    },
    select: { id: true, companyId: true, status: true },
    orderBy: { paidAt: "asc" },
    ...(options.limit ? { take: options.limit } : {}),
  });

  for (const order of podCandidates) {
    if (normalizeOrderStatus(order.status) !== "paid") continue;

    try {
      await cleanupOrderPod(order);
      summary.podCleaned += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(
        `[gdpr-cleanup] failed to clean POD attachments for order ${order.id}:`,
        toErrorMessage(error),
      );
    }
  }

  if (summary.failed > 0) {
    console.error("[gdpr-cleanup] run completed with failures", summary);
  }

  return summary;
}
