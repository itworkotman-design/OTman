import { prisma } from "@/lib/db";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";
import { parseOrderStateSnapshot } from "@/lib/orders/paidOrderSnapshot";
import { alertStaff } from "@/lib/orders/staffAlerts";
import { formatKr } from "@/lib/orders/orderChangeText";
import { invoiceCustomer } from "./invoiceDocument";
import {
  buildCreditNote,
  buildCreditNoteEmail,
  creditNotePreviousSnapshot,
  receiptFilename,
  receiptSellerFromEnv,
  type Receipt,
  type ReceiptSeller,
} from "./receiptDocument";
import { renderReceiptPdf } from "./receiptPdf";
import { allocateReceiptNumber } from "./receiptNumbers";
import { formatReceiptNumber } from "./receiptSeries";
import { emailSalesDocument } from "./salesDocumentEmail";

// The credit note (kreditnota) for a Stripe refund on a homepage order — the
// sales document for money paid back, as the receipt (paymentReceipts.ts) is
// for money taken. One per OrderRefund, numbered in the same web-sales series
// (W-<n>, receiptNumbers.ts), referring to the receipt of the payment it pays
// back, kept in S3 and emailed to the customer. Sent right after the refund
// is recorded (sendCreditNotesForStripeRefunds, called by everything that
// refunds through lib/orders/orderRefunds.ts). Never throws: a credit note
// that can't go out raises a staff alert.

export const CREDIT_NOTE_REFUND_SELECT = {
  id: true,
  orderId: true,
  companyId: true,
  amountRefundedCents: true,
  orderSnapshot: true,
  createdAt: true,
  receiptNumber: true,
  receiptSentAt: true,
  receiptPdfKey: true,
  orderPayment: { select: { receiptNumber: true } },
  order: {
    select: {
      displayId: true,
      orderNumber: true,
      email: true,
      customerName: true,
      customerLabel: true,
      deliveryAddress: true,
      pickupAddress: true,
      websiteBookingDetails: true,
      deliveryDate: true,
      emailThreadToken: true,
      payments: { select: { createdAt: true, orderSnapshot: true } },
      refunds: { select: { id: true, createdAt: true, orderSnapshot: true } },
    },
  },
} as const;

type CreditNoteRefund = {
  id: string;
  amountRefundedCents: number;
  orderSnapshot: unknown;
  createdAt: Date;
  orderPayment: { receiptNumber: number | null };
  order: {
    displayId: number;
    orderNumber: string | null;
    email: string | null;
    customerName: string | null;
    customerLabel: string | null;
    deliveryAddress: string | null;
    pickupAddress: string | null;
    websiteBookingDetails: unknown;
    deliveryDate: string | null;
    payments: { createdAt: Date; orderSnapshot: unknown }[];
    refunds: { id: string; createdAt: Date; orderSnapshot: unknown }[];
  };
};

export function creditNoteForRefund(refund: CreditNoteRefund, number: number, seller: ReceiptSeller): Receipt {
  const { order } = refund;
  return buildCreditNote({
    number,
    refundedAt: refund.createdAt,
    orderNumber: order.orderNumber?.trim() || String(order.displayId),
    deliveryDate: order.deliveryDate,
    seller,
    customer: invoiceCustomer(order),
    amountRefundedCents: refund.amountRefundedCents,
    creditsReceiptNumber: refund.orderPayment.receiptNumber ? formatReceiptNumber(refund.orderPayment.receiptNumber) : null,
    previous: creditNotePreviousSnapshot(refund, order.payments, order.refunds),
    snapshot: parseOrderStateSnapshot(refund.orderSnapshot),
  });
}

export type SendRefundCreditNoteResult =
  | { ok: true; number: number }
  | { ok: false; reason: "REFUND_NOT_FOUND" | "ALREADY_SENT" | "SETTINGS_MISSING" | "MISSING_CUSTOMER_EMAIL" | "SEND_FAILED" };

const STRIPE_ACTOR = { source: "SYSTEM" as const, name: "Stripe" };

// `resend`: staff send it again (the Payment tab) — same number.
export async function sendRefundCreditNote(params: { refundId: string; resend?: boolean; now?: Date }): Promise<SendRefundCreditNoteResult> {
  const now = params.now ?? new Date();
  let orderRef: { orderId: string; companyId: string } | null = null;
  const fail = async (reason: Exclude<SendRefundCreditNoteResult, { ok: true }>["reason"], why: string): Promise<SendRefundCreditNoteResult> => {
    if (orderRef) {
      await alertStaff({
        ...orderRef,
        title: "Credit note not sent",
        message: `The customer did not get the credit note for their Stripe refund: ${why}`,
      });
    }
    return { ok: false, reason };
  };

  try {
    const refund = await prisma.orderRefund.findUnique({ where: { id: params.refundId }, select: CREDIT_NOTE_REFUND_SELECT });
    if (!refund) return { ok: false, reason: "REFUND_NOT_FOUND" };
    if (refund.receiptSentAt && !params.resend) return { ok: false, reason: "ALREADY_SENT" };
    orderRef = { orderId: refund.orderId, companyId: refund.companyId };

    const seller = receiptSellerFromEnv();
    if (!seller) return fail("SETTINGS_MISSING", "the seller name or org number (INVOICE_SELLER_NAME / INVOICE_ORG_NUMBER) is not set.");
    const email = refund.order.email?.trim();
    if (!email) return fail("MISSING_CUSTOMER_EMAIL", "the order has no customer email.");

    const number = refund.receiptNumber ?? (await allocateReceiptNumber({ orderRefundId: refund.id }));
    const note = creditNoteForRefund(refund, number, seller);
    const pdf = Buffer.from(await renderReceiptPdf(note));
    const { subject, html } = buildCreditNoteEmail({
      number: note.number,
      orderNumber: note.orderNumber,
      customerName: note.customer.name,
      amountIncVatNok: note.totalIncVatNok,
    });
    const { pdfKey } = await emailSalesDocument({
      orderId: refund.orderId,
      companyId: refund.companyId,
      order: { ...refund.order, email },
      subject,
      html,
      filename: receiptFilename(note.number, "creditNote"),
      pdf,
      now,
    });

    await prisma.orderRefund.update({ where: { id: refund.id }, data: { receiptSentAt: now, receiptPdfKey: pdfKey } });
    await createOrderActionEvent(prisma, {
      orderId: refund.orderId,
      companyId: refund.companyId,
      actor: STRIPE_ACTOR,
      title: `Credit note ${note.number} sent`,
      details: [`Amount: ${formatKr(note.totalIncVatNok)}`, `Recipient: ${email}`],
      createdAt: now,
    });
    return { ok: true, number };
  } catch (error) {
    console.error("[creditNotes] Sending the credit note failed", params.refundId, error);
    return fail("SEND_FAILED", `the email could not be sent (${error instanceof Error ? error.message : "unknown error"}).`);
  }
}

// The credit notes for refunds refundOrderPayments just made (its
// stripeRefundIds), oldest first so the numbers follow the refunds. Never
// throws.
export async function sendCreditNotesForStripeRefunds(stripeRefundIds: string[]): Promise<void> {
  if (stripeRefundIds.length === 0) return;
  try {
    const refunds = await prisma.orderRefund.findMany({
      where: { stripeRefundId: { in: stripeRefundIds } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    for (const refund of refunds) await sendRefundCreditNote({ refundId: refund.id });
  } catch (error) {
    console.error("[creditNotes] Could not send credit notes", stripeRefundIds, error);
  }
}
