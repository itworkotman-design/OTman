import { prisma } from "@/lib/db";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";
import { parseOrderStateSnapshot } from "@/lib/orders/paidOrderSnapshot";
import { alertStaff } from "@/lib/orders/staffAlerts";
import { formatKr } from "@/lib/orders/orderChangeText";
import { invoiceCustomer } from "./invoiceDocument";
import {
  buildReceipt,
  buildReceiptEmail,
  receiptFilename,
  receiptPreviousSnapshot,
  receiptSellerFromEnv,
  type Receipt,
  type ReceiptSeller,
} from "./receiptDocument";
import { renderReceiptPdf } from "./receiptPdf";
import { allocateReceiptNumber } from "./receiptNumbers";
import { emailSalesDocument } from "./salesDocumentEmail";

// The receipt (kvittering) for a Stripe payment on a homepage order: given
// the next number in the web-sales series W-<n> (receiptNumbers.ts, shared
// with refund credit notes), drawn
// (receiptPdf.ts), kept in S3 and emailed to the customer. Sent once, right
// after the payment is recorded (lib/stripe/checkoutSessionHandlers.ts).
// Never throws: a receipt that can't go out raises a staff alert.

export const RECEIPT_PAYMENT_SELECT = {
  id: true,
  orderId: true,
  companyId: true,
  amountChargedCents: true,
  orderSnapshot: true,
  createdAt: true,
  receiptNumber: true,
  receiptSentAt: true,
  receiptPdfKey: true,
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
      payments: { select: { id: true, createdAt: true, orderSnapshot: true } },
      refunds: { select: { createdAt: true, orderSnapshot: true } },
    },
  },
} as const;

type ReceiptPayment = {
  id: string;
  amountChargedCents: number;
  orderSnapshot: unknown;
  createdAt: Date;
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
    payments: { id: string; createdAt: Date; orderSnapshot: unknown }[];
    refunds: { createdAt: Date; orderSnapshot: unknown }[];
  };
};

export function receiptForPayment(payment: ReceiptPayment, number: number, seller: ReceiptSeller): Receipt {
  const { order } = payment;
  return buildReceipt({
    number,
    paidAt: payment.createdAt,
    orderNumber: order.orderNumber?.trim() || String(order.displayId),
    deliveryDate: order.deliveryDate,
    seller,
    customer: invoiceCustomer(order),
    amountChargedCents: payment.amountChargedCents,
    previous: receiptPreviousSnapshot(payment, order.payments, order.refunds),
    snapshot: parseOrderStateSnapshot(payment.orderSnapshot),
  });
}

export type SendPaymentReceiptResult =
  | { ok: true; number: number }
  | { ok: false; reason: "PAYMENT_NOT_FOUND" | "ALREADY_SENT" | "SETTINGS_MISSING" | "MISSING_CUSTOMER_EMAIL" | "SEND_FAILED" };

const STRIPE_ACTOR = { source: "SYSTEM" as const, name: "Stripe" };

// `resend`: staff send it again (the Payment tab) — same number.
export async function sendPaymentReceipt(params: { paymentId: string; resend?: boolean; now?: Date }): Promise<SendPaymentReceiptResult> {
  const now = params.now ?? new Date();
  let orderRef: { orderId: string; companyId: string } | null = null;
  const fail = async (reason: Exclude<SendPaymentReceiptResult, { ok: true }>["reason"], why: string): Promise<SendPaymentReceiptResult> => {
    if (orderRef) {
      await alertStaff({
        ...orderRef,
        title: "Receipt not sent",
        message: `The customer did not get the receipt for their Stripe payment: ${why}`,
      });
    }
    return { ok: false, reason };
  };

  try {
    const payment = await prisma.orderPayment.findUnique({ where: { id: params.paymentId }, select: RECEIPT_PAYMENT_SELECT });
    if (!payment) return { ok: false, reason: "PAYMENT_NOT_FOUND" };
    if (payment.receiptSentAt && !params.resend) return { ok: false, reason: "ALREADY_SENT" };
    orderRef = { orderId: payment.orderId, companyId: payment.companyId };

    const seller = receiptSellerFromEnv();
    if (!seller) return fail("SETTINGS_MISSING", "the seller name or org number (INVOICE_SELLER_NAME / INVOICE_ORG_NUMBER) is not set.");
    const email = payment.order.email?.trim();
    if (!email) return fail("MISSING_CUSTOMER_EMAIL", "the order has no customer email.");

    const number = payment.receiptNumber ?? (await allocateReceiptNumber({ orderPaymentId: payment.id }));
    const receipt = receiptForPayment(payment, number, seller);
    const pdf = Buffer.from(await renderReceiptPdf(receipt));
    const { subject, html } = buildReceiptEmail({
      number: receipt.number,
      orderNumber: receipt.orderNumber,
      customerName: receipt.customer.name,
      amountIncVatNok: receipt.totalIncVatNok,
    });
    const { pdfKey } = await emailSalesDocument({
      orderId: payment.orderId,
      companyId: payment.companyId,
      order: { ...payment.order, email },
      subject,
      html,
      filename: receiptFilename(receipt.number),
      pdf,
      now,
    });

    await prisma.orderPayment.update({ where: { id: payment.id }, data: { receiptSentAt: now, receiptPdfKey: pdfKey } });
    await createOrderActionEvent(prisma, {
      orderId: payment.orderId,
      companyId: payment.companyId,
      actor: STRIPE_ACTOR,
      title: `Receipt ${receipt.number} sent`,
      details: [`Amount: ${formatKr(receipt.totalIncVatNok)}`, `Recipient: ${email}`],
      createdAt: now,
    });
    return { ok: true, number };
  } catch (error) {
    console.error("[receipts] Sending the receipt failed", params.paymentId, error);
    return fail("SEND_FAILED", `the email could not be sent (${error instanceof Error ? error.message : "unknown error"}).`);
  }
}
