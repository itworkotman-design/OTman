import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deleteAttachmentFile } from "@/lib/orders/orderAttachmentStorage";
import { GDPR_REDACTED, isFinishedWebsiteOrderStatus, scrubBookingDetails, scrubEventPayload, scrubStateSnapshot } from "./websiteOrderScrub";

// The GDPR sweep for homepage (website) orders. The B2B sweep in
// ./runGdprCleanup.ts keys off an order being Paid (Fakturert → Betalt),
// which a homepage order never becomes, so these get their own: 90 days
// after the order is finished (completed, cancelled, declined/refunded or
// rejected — counted from statusChangedAt) every bit of the customer's
// personal data goes, wherever the order keeps it:
// - the order's contact, address, comment and note fields, and its stored
//   booking details (websiteBookingDetails — every stop's address/contact);
// - email, SMS and GSM task contents (as the B2B sweep does);
// - the order history (personal before/after values, notes, action details);
// - notification texts;
// - the order as recorded on each Stripe payment and refund (stop addresses);
// - every attachment (pickup documents, photos, proof of delivery).
// Kept: amounts, products, lines, dates, statuses, Stripe ids and fakturas —
// the accounting trail. `gdprHold` pauses it, as for B2B orders.

export const WEBSITE_ANONYMIZE_AFTER_DAYS = 90;

const REDACTED_EMAIL = "gdpr-anonymized@deleted.invalid";
const REDACTED_SUBJECT = "[GDPR: subject anonymized]";
const REDACTED_BODY = "[GDPR: message content anonymized]";
const REDACTED_PHONE = "[GDPR: phone anonymized]";

const CLEARED_ORDER_FIELDS = [
  "customerName",
  "customerLabel",
  "phone",
  "phoneTwo",
  "email",
  "deliveryAddress",
  "pickupAddress",
  "extraPickupAddress",
  "extraPickupContacts",
  "customerComments",
  "description",
  "statusNotes",
  "floorNo",
  "lift",
  "customTimeContactNote",
  "websiteBookingDetails",
] as const;

type Candidate = { id: string; companyId: string; status: string | null; websiteBookingDetails: Prisma.JsonValue | null };

const DAY_MS = 24 * 60 * 60 * 1000;

const asJson = (value: unknown) => (value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue));
const changed = (before: unknown, after: unknown) => JSON.stringify(before) !== JSON.stringify(after);

async function anonymizeWebsiteOrder(order: Candidate, now: Date): Promise<void> {
  const [emailMessages, smsMessages, gsmTasks, notifications] = await Promise.all([
    prisma.orderEmailMessage.updateMany({
      where: { orderId: order.id },
      data: {
        subject: REDACTED_SUBJECT,
        bodyText: REDACTED_BODY,
        bodyHtml: null,
        fromName: null,
        toName: null,
        fromEmail: REDACTED_EMAIL,
        toEmail: REDACTED_EMAIL,
      },
    }),
    prisma.orderSmsMessage.updateMany({ where: { orderId: order.id }, data: { toPhone: REDACTED_PHONE, body: REDACTED_BODY } }),
    prisma.orderGsmTask.updateMany({ where: { orderId: order.id }, data: { address: null } }),
    prisma.orderNotification.updateMany({ where: { orderId: order.id }, data: { message: GDPR_REDACTED, payload: Prisma.DbNull } }),
  ]);

  // The history, and the order as each payment/refund recorded it — only the
  // rows the scrub actually changes are rewritten.
  const [events, payments, refunds] = await Promise.all([
    prisma.orderEvent.findMany({ where: { orderId: order.id }, select: { id: true, payload: true } }),
    prisma.orderPayment.findMany({ where: { orderId: order.id }, select: { id: true, orderSnapshot: true } }),
    prisma.orderRefund.findMany({ where: { orderId: order.id }, select: { id: true, orderSnapshot: true } }),
  ]);
  let historyEntries = 0;
  for (const event of events) {
    const scrubbed = scrubEventPayload(event.payload);
    if (!changed(event.payload, scrubbed)) continue;
    await prisma.orderEvent.update({ where: { id: event.id }, data: { payload: scrubbed as Prisma.InputJsonValue } });
    historyEntries += 1;
  }
  for (const payment of payments) {
    const scrubbed = scrubStateSnapshot(payment.orderSnapshot);
    if (changed(payment.orderSnapshot, scrubbed)) {
      await prisma.orderPayment.update({ where: { id: payment.id }, data: { orderSnapshot: asJson(scrubbed) } });
    }
  }
  for (const refund of refunds) {
    const scrubbed = scrubStateSnapshot(refund.orderSnapshot);
    if (changed(refund.orderSnapshot, scrubbed)) {
      await prisma.orderRefund.update({ where: { id: refund.id }, data: { orderSnapshot: asJson(scrubbed) } });
    }
  }

  const attachments = await prisma.orderAttachment.findMany({ where: { orderId: order.id }, select: { id: true, storagePath: true } });
  for (const attachment of attachments) await deleteAttachmentFile(attachment.storagePath);
  if (attachments.length > 0) {
    await prisma.orderAttachment.deleteMany({ where: { id: { in: attachments.map((attachment) => attachment.id) } } });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      customerName: null,
      customerLabel: null,
      phone: null,
      phoneTwo: null,
      email: null,
      deliveryAddress: null,
      pickupAddress: null,
      extraPickupAddress: [],
      extraPickupContacts: Prisma.DbNull,
      customerComments: null,
      description: null,
      statusNotes: null,
      floorNo: null,
      lift: null,
      customTimeContactNote: null,
      websiteBookingDetails: asJson(scrubBookingDetails(order.websiteBookingDetails)),
      gdprAnonymized: true,
      gdprDeletedAt: now,
    },
  });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      companyId: order.companyId,
      type: "GDPR_ANONYMIZED",
      actorMembershipId: null,
      payload: {
        fields: [...CLEARED_ORDER_FIELDS],
        trigger: "website_finished_90d",
        relatedCleared: {
          emailMessages: emailMessages.count,
          smsMessages: smsMessages.count,
          gsmTasks: gsmTasks.count,
          notifications: notifications.count,
          historyEntries,
          attachments: attachments.length,
        },
      },
    },
  });
}

// Called by runGdprCleanup (the daily cron, and the dashboard's "Run now"
// scoped to one company). `limit` caps how many orders are anonymized.
export async function runWebsiteOrderGdprCleanup(
  options: { companyId?: string; limit?: number; now?: Date } = {},
): Promise<{ anonymized: number; failed: number }> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - WEBSITE_ANONYMIZE_AFTER_DAYS * DAY_MS);
  const summary = { anonymized: 0, failed: 0 };

  const candidates = await prisma.order.findMany({
    where: {
      isWebsiteOrder: true,
      gdprHold: false,
      gdprAnonymized: false,
      ...(options.companyId ? { companyId: options.companyId } : {}),
      // Older orders may have no statusChangedAt: their last update stands in.
      OR: [{ statusChangedAt: { lte: cutoff } }, { statusChangedAt: null, updatedAt: { lte: cutoff } }],
    },
    select: { id: true, companyId: true, status: true, websiteBookingDetails: true },
    orderBy: { statusChangedAt: "asc" },
  });

  // Stored statuses aren't fully normalized, so "finished" is decided here.
  const finished = candidates.filter((order) => isFinishedWebsiteOrderStatus(order.status));
  for (const order of options.limit ? finished.slice(0, options.limit) : finished) {
    try {
      await anonymizeWebsiteOrder(order, now);
      summary.anonymized += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`[gdpr-cleanup] failed to anonymize website order ${order.id}:`, error instanceof Error ? error.message.slice(0, 500) : error);
    }
  }
  return summary;
}
