import { prisma } from "@/lib/db";
import { sendGmailEmail } from "@/lib/email/sendGmailEmail";
import { formatGmailSenderName, getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import { htmlToText } from "@/lib/email/htmlToText";
import { createOrderActionEvent, type OrderEventActor } from "@/lib/orders/orderEvents";
import { buildReplyToAddress, createOrderEmailThreadToken } from "@/lib/orders/orderEmail";
import { isS3AttachmentStorageConfigured, uploadAttachmentBufferToS3 } from "@/lib/orders/orderAttachmentStorage";
import { buildOrderStateSnapshot, ORDER_STATE_SOURCE_SELECT } from "@/lib/orders/paidOrderSnapshot";
import { invoiceLedger, invoiceNumber, nextPaymentStatus, type InvoiceEntry, type InvoiceKind, type PaymentStatus } from "@/lib/orders/manualPayments";
import { formatKr } from "@/lib/orders/orderChangeText";
import {
  buildInvoiceEmail,
  invoiceCustomer,
  invoiceDocumentEntries,
  invoiceDueDate,
  invoiceFilename,
  invoiceSellerFromEnv,
} from "./invoiceDocument";
import { renderInvoicePdf } from "./invoicePdf";

// Manual faktura payments for homepage orders (lib/orders/manualPayments.ts):
// send a faktura (or kreditnota) for what the order's total has moved since
// the last one, mark fakturas paid, and recompute the order's payment status
// after a price change. The PDF carries every faktura so far (invoicePdf.ts)
// and is stored as sent, so the Payment tab shows what the customer got.

export const INVOICE_ENTRY_SELECT = {
  sequence: true,
  kind: true,
  amountCents: true,
  totalAfterCents: true,
  orderSnapshot: true,
  paidAt: true,
  createdAt: true,
} as const;

const INVOICE_ORDER_SELECT = {
  ...ORDER_STATE_SOURCE_SELECT,
  id: true,
  companyId: true,
  displayId: true,
  orderNumber: true,
  email: true,
  customerName: true,
  customerLabel: true,
  emailThreadToken: true,
  paymentStatus: true,
  invoices: { select: INVOICE_ENTRY_SELECT, orderBy: { sequence: "asc" as const } },
} as const;

type StoredEntry = Omit<InvoiceEntry, "kind"> & { kind: string };
const asEntries = (rows: StoredEntry[]): InvoiceEntry[] =>
  rows.map((row) => ({ ...row, kind: row.kind === "refund" ? "refund" : "invoice" }));

export type SendOrderInvoiceResult =
  | {
      ok: true;
      invoice: { id: string; sequence: number; invoiceNumber: string; kind: InvoiceKind; amountCents: number; totalAfterCents: number };
      paymentStatus: PaymentStatus | null;
    }
  // The order changed since staff saw the amount: nothing sent, here's the current one.
  | { ok: false; reason: "AMOUNT_CHANGED"; amountCents: number }
  | {
      ok: false;
      reason:
        | "ORDER_NOT_FOUND"
        | "INVOICE_SETTINGS_MISSING"
        | "MISSING_CUSTOMER_EMAIL"
        | "NOTHING_TO_INVOICE"
        | "NOTHING_TO_REFUND"
        | "INVOICE_IN_PROGRESS"
        | "INVOICE_SEND_FAILED";
    };

// kind "invoice": a faktura for what the order costs beyond what's been
// invoiced (the whole total the first time). kind "refund": a kreditnota for
// what was invoiced beyond the total — money owed back, recorded as settled.
export async function sendOrderInvoice(params: {
  orderId: string;
  companyId: string;
  actor: OrderEventActor;
  kind: InvoiceKind;
  // The amount the admin's button showed (cents); omitted for the automatic
  // first faktura at booking.
  expectedAmountCents?: number;
  now?: Date;
}): Promise<SendOrderInvoiceResult> {
  const now = params.now ?? new Date();
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, companyId: params.companyId },
    select: INVOICE_ORDER_SELECT,
  });
  if (!order) return { ok: false, reason: "ORDER_NOT_FOUND" };

  const settings = invoiceSellerFromEnv();
  if (!settings) return { ok: false, reason: "INVOICE_SETTINGS_MISSING" };
  const email = order.email?.trim();
  if (!email) return { ok: false, reason: "MISSING_CUSTOMER_EMAIL" };

  const entries = asEntries(order.invoices);
  const current = buildOrderStateSnapshot(order);
  const ledger = invoiceLedger(entries, current);
  const differenceCents = Math.round(ledger.differenceIncVatNok * 100);
  if (params.kind === "invoice" && differenceCents <= 0) return { ok: false, reason: "NOTHING_TO_INVOICE" };
  if (params.kind === "refund" && differenceCents >= 0) return { ok: false, reason: "NOTHING_TO_REFUND" };
  if (params.expectedAmountCents !== undefined && params.expectedAmountCents !== Math.abs(differenceCents)) {
    return { ok: false, reason: "AMOUNT_CHANGED", amountCents: Math.abs(differenceCents) };
  }

  const sequence = entries.reduce((max, entry) => Math.max(max, entry.sequence), 0) + 1;
  const newEntry: InvoiceEntry = {
    sequence,
    kind: params.kind,
    amountCents: Math.abs(differenceCents),
    totalAfterCents: Math.round(current.totalIncVatNok * 100),
    orderSnapshot: current,
    // A kreditnota is the refund itself: settled when recorded.
    paidAt: params.kind === "refund" ? now : null,
    createdAt: now,
  };
  const number = invoiceNumber(order.displayId, newEntry);

  // Claims the sequence first: a second click racing this one hits the
  // unique (orderId, sequence) and stops before anything is emailed.
  let created: { id: string };
  try {
    created = await prisma.orderInvoice.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        sequence,
        invoiceNumber: number,
        kind: params.kind,
        amountCents: newEntry.amountCents,
        totalAfterCents: newEntry.totalAfterCents,
        orderSnapshot: current,
        dueDate: invoiceDueDate(now, settings.dueDays),
        paidAt: newEntry.paidAt,
        ...(params.kind === "refund" ? { paidByMembershipId: params.actor.membershipId ?? null } : {}),
        sentByMembershipId: params.actor.membershipId ?? null,
        createdAt: now,
      },
      select: { id: true },
    });
  } catch {
    return { ok: false, reason: "INVOICE_IN_PROGRESS" };
  }

  let pdfKey: string | null = null;
  let emailMessageId: string | null = null;
  const threadToken = order.emailThreadToken || createOrderEmailThreadToken();
  const customer = invoiceCustomer(order);
  try {
    const pdf = Buffer.from(
      await renderInvoicePdf({
        displayId: order.displayId,
        seller: settings.seller,
        customer,
        entries: invoiceDocumentEntries(order.displayId, [...entries, newEntry], { dueDays: settings.dueDays }),
      }),
    );
    const filename = invoiceFilename(params.kind, number);
    if (isS3AttachmentStorageConfigured()) {
      pdfKey = (await uploadAttachmentBufferToS3({ bytes: pdf, scope: `invoices/${order.id}`, filename, contentType: "application/pdf" }))
        .storagePath;
    }

    const { subject, html } = buildInvoiceEmail({
      kind: params.kind,
      number,
      displayId: order.displayId,
      customerName: customer.name,
      amountIncVatNok: newEntry.amountCents / 100,
      dueDate: invoiceDueDate(now, settings.dueDays),
      bankAccount: settings.seller.bankAccount,
    });
    const recipientName = order.customerName ?? order.customerLabel ?? undefined;
    const sent = await sendGmailEmail({
      to: { email, name: recipientName },
      threadToken,
      subject,
      html,
      text: htmlToText(html),
      replyTo: buildReplyToAddress(threadToken),
      orderId: order.id,
      orderNumber: order.orderNumber ?? null,
      direction: "outbound",
      attachments: [{ filename, contentType: "application/pdf", content: pdf }],
    });
    const message = await prisma.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "OUTBOUND",
        status: sent.syncWarning ? "SENT_WITH_SYNC_WARNING" : "SENT",
        source: "GMAIL",
        sentByMembershipId: params.actor.membershipId ?? null,
        externalMessageId: sent.messageId,
        gmailMessageId: sent.gmailMessageId,
        gmailThreadId: sent.gmailThreadId,
        subject,
        bodyHtml: html,
        fromEmail: getGmailSendAsEmail(),
        fromName: formatGmailSenderName(),
        toEmail: email,
        toName: recipientName ?? null,
        sentAt: now,
      },
      select: { id: true },
    });
    emailMessageId = message.id;
  } catch (error) {
    console.error("[invoices] sending faktura failed", { orderId: order.id, number, error });
    await prisma.orderInvoice.delete({ where: { id: created.id } }).catch(() => undefined);
    return { ok: false, reason: "INVOICE_SEND_FAILED" };
  }

  await prisma.orderInvoice.update({ where: { id: created.id }, data: { pdfKey, emailMessageId } });
  const paymentStatus = nextPaymentStatus([...entries, newEntry], current.totalIncVatNok);
  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus,
      lastOutboundEmailAt: now,
      ...(order.emailThreadToken ? {} : { emailThreadToken: threadToken }),
    },
  });
  await createOrderActionEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: params.actor,
    title: params.kind === "refund" ? `Kreditnota ${number} sent` : `Faktura ${number} sent`,
    details: [`Amount: ${formatKr(newEntry.amountCents / 100)}`, `Recipient: ${email}`, `Payment status: ${paymentStatus ?? "—"}`],
    createdAt: now,
  });

  return {
    ok: true,
    invoice: {
      id: created.id,
      sequence,
      invoiceNumber: number,
      kind: params.kind,
      amountCents: newEntry.amountCents,
      totalAfterCents: newEntry.totalAfterCents,
    },
    paymentStatus,
  };
}

// The Mark paid button: every unpaid faktura is now paid. The order is
// "paid" when that covers its current total; a price change not invoiced yet
// keeps it pending.
export async function markOrderInvoicesPaid(params: {
  orderId: string;
  companyId: string;
  actor: OrderEventActor;
  now?: Date;
}): Promise<{ ok: true; paymentStatus: PaymentStatus | null } | { ok: false; reason: "ORDER_NOT_FOUND" | "NOTHING_TO_MARK_PAID" }> {
  const now = params.now ?? new Date();
  const order = await prisma.order.findFirst({ where: { id: params.orderId, companyId: params.companyId }, select: INVOICE_ORDER_SELECT });
  if (!order) return { ok: false, reason: "ORDER_NOT_FOUND" };
  const unpaid = order.invoices.filter((entry) => entry.kind === "invoice" && !entry.paidAt);
  if (unpaid.length === 0) return { ok: false, reason: "NOTHING_TO_MARK_PAID" };

  await prisma.orderInvoice.updateMany({
    where: { orderId: order.id, kind: "invoice", paidAt: null },
    data: { paidAt: now, paidByMembershipId: params.actor.membershipId ?? null },
  });
  const paymentStatus = await refreshOrderPaymentStatus(order.id);
  await createOrderActionEvent(prisma, {
    orderId: order.id,
    companyId: order.companyId,
    actor: params.actor,
    title: "Marked paid",
    details: [
      `Faktura: ${unpaid.map((entry) => invoiceNumber(order.displayId, { sequence: entry.sequence, kind: "invoice" })).join(", ")}`,
      `Amount: ${formatKr(unpaid.reduce((sum, entry) => sum + entry.amountCents, 0) / 100)}`,
      `Payment status: ${paymentStatus ?? "—"}`,
    ],
    createdAt: now,
  });
  return { ok: true, paymentStatus };
}

export type OrderInvoiceView = {
  id: string;
  number: string;
  kind: InvoiceKind;
  amountIncVatNok: number;
  totalAfterIncVatNok: number;
  createdAt: string;
  dueDate: string;
  paidAt: string | null;
  // Display names; null sentBy = the automatic faktura at booking.
  sentBy: string | null;
  paidBy: string | null;
  hasPdf: boolean;
};

export type OrderInvoiceOverview = {
  paymentStatus: PaymentStatus | null;
  ledger: ReturnType<typeof invoiceLedger>;
  invoices: OrderInvoiceView[];
};

// Everything the Payment tab and the Payment card show: the fakturas (oldest
// first), the ledger against the order as it is now, and its payment status.
export async function getOrderInvoiceOverview(orderId: string, companyId: string): Promise<OrderInvoiceOverview | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    select: {
      ...INVOICE_ORDER_SELECT,
      invoices: {
        select: {
          ...INVOICE_ENTRY_SELECT,
          id: true,
          invoiceNumber: true,
          dueDate: true,
          paidByMembershipId: true,
          sentByMembershipId: true,
          pdfKey: true,
        },
        orderBy: { sequence: "asc" as const },
      },
    },
  });
  if (!order) return null;

  const memberIds = [
    ...new Set(order.invoices.flatMap((row) => [row.sentByMembershipId, row.paidByMembershipId]).filter((id): id is string => !!id)),
  ];
  const members = memberIds.length
    ? await prisma.membership.findMany({ where: { id: { in: memberIds } }, select: { id: true, user: { select: { username: true, email: true } } } })
    : [];
  const nameOf = (id: string | null) => {
    const member = id ? members.find((m) => m.id === id) : null;
    return member ? member.user.username || member.user.email : null;
  };

  return {
    paymentStatus: order.paymentStatus === "paid" || order.paymentStatus === "pending" ? order.paymentStatus : null,
    ledger: invoiceLedger(asEntries(order.invoices), buildOrderStateSnapshot(order)),
    invoices: order.invoices.map((row) => ({
      id: row.id,
      number: row.invoiceNumber,
      kind: row.kind === "refund" ? "refund" : "invoice",
      amountIncVatNok: row.amountCents / 100,
      totalAfterIncVatNok: row.totalAfterCents / 100,
      createdAt: row.createdAt.toISOString(),
      dueDate: row.dueDate.toISOString(),
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      sentBy: nameOf(row.sentByMembershipId),
      paidBy: nameOf(row.paidByMembershipId),
      hasPdf: !!row.pdfKey,
    })),
  };
}

// After anything that changes an order's price: its payment status again
// (nextPaymentStatus). Orders without fakturas are left alone (null).
export async function refreshOrderPaymentStatus(orderId: string): Promise<PaymentStatus | null> {
  const order = await prisma.order.findFirst({ where: { id: orderId }, select: INVOICE_ORDER_SELECT });
  if (!order || order.invoices.length === 0) return null;
  const paymentStatus = nextPaymentStatus(asEntries(order.invoices), buildOrderStateSnapshot(order).totalIncVatNok);
  if (paymentStatus !== order.paymentStatus) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus } });
  }
  return paymentStatus;
}
