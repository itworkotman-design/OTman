import { formatKr } from "@/lib/orders/orderChangeText";
import { buildSimpleEmailShell, escapeHtml } from "@/lib/orders/customerLifecycleEmails";
import { invoiceCalculatorLines, type InvoiceCalculatorLine } from "@/lib/orders/manualPayments";
import { ADJUSTMENT_GROUP, EXTRAS_GROUP, parseOrderStateSnapshot, type OrderStateSnapshot } from "@/lib/orders/paidOrderSnapshot";
import { localizeWebsiteLineLabel, localizeWebsiteProductName } from "@/lib/content/websiteLineLabels";
import { roundNok } from "@/lib/orders/orderTotals";
import type { InvoiceCustomer } from "./invoicePdf";

// A receipt (kvittering — the sales document) for a homepage order's Stripe
// payment: one per OrderPayment, numbered in one series across all orders
// (OrderPayment.receiptNumber, lib/invoices/paymentReceipts.ts). The pure
// content lives here; receiptPdf.ts draws it.

export type ReceiptSeller = { name: string; orgNumber: string; address: string; email: string };

// The same INVOICE_* settings as the faktura, minus the bank account: a
// receipt needs the seller's name and org number.
export function receiptSellerFromEnv(env: Record<string, string | undefined> = process.env): ReceiptSeller | null {
  const name = env.INVOICE_SELLER_NAME?.trim();
  const orgNumber = env.INVOICE_ORG_NUMBER?.trim();
  if (!name || !orgNumber) return null;
  return { name, orgNumber, address: env.INVOICE_ADDRESS?.trim() ?? "", email: env.INVOICE_EMAIL?.trim() ?? "" };
}

type Snapshotted = { createdAt: Date; orderSnapshot: unknown };

// What this payment is compared against: the order as of the last payment or
// refund before it (null for the first payment — it covers everything).
export function receiptPreviousSnapshot(
  payment: Snapshotted & { id: string },
  payments: (Snapshotted & { id: string })[],
  refunds: Snapshotted[],
): OrderStateSnapshot | null {
  const earlier = [...payments.filter((p) => p.id !== payment.id), ...refunds]
    .filter((entry) => entry.createdAt.getTime() < payment.createdAt.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const entry of earlier) {
    const parsed = parseOrderStateSnapshot(entry.orderSnapshot);
    if (parsed) return parsed;
  }
  return null;
}

// A line as the customer saw it: the order stores the English catalog names
// and internal group keys, the receipt is in Norwegian (as the pay page).
function norwegianLine(line: InvoiceCalculatorLine): InvoiceCalculatorLine {
  if (line.group === EXTRAS_GROUP) return { ...line, group: "Tillegg", label: localizeWebsiteLineLabel(line.label, "no") };
  if (line.group === ADJUSTMENT_GROUP) return { ...line, group: "Justering", label: line.label === "discount" ? "Rabatt" : "Tillegg" };
  return { ...line, group: localizeWebsiteProductName(line.group, "no"), label: localizeWebsiteLineLabel(line.label, "no") };
}

export type Receipt = {
  number: string;
  paidAt: Date;
  orderNumber: string;
  deliveryDate: string | null;
  seller: ReceiptSeller;
  customer: InvoiceCustomer;
  lines: InvoiceCalculatorLine[];
  // What was charged (the card payment), incl. VAT; the VAT is 25 % of it.
  totalIncVatNok: number;
  exVatNok: number;
  vatNok: number;
};

export function buildReceipt(input: {
  number: number;
  paidAt: Date;
  orderNumber: string;
  deliveryDate: string | null;
  seller: ReceiptSeller;
  customer: InvoiceCustomer;
  amountChargedCents: number;
  previous: OrderStateSnapshot | null;
  snapshot: OrderStateSnapshot | null;
}): Receipt {
  const total = roundNok(input.amountChargedCents / 100);
  const exVat = roundNok(total / 1.25);
  const lines = input.snapshot
    ? invoiceCalculatorLines(input.previous, input.snapshot).map(norwegianLine)
    : [{ group: "", label: `Betaling for ordre ${input.orderNumber}`, qty: 1, price: total }];
  return {
    number: String(input.number),
    paidAt: input.paidAt,
    orderNumber: input.orderNumber,
    deliveryDate: input.deliveryDate,
    seller: input.seller,
    customer: input.customer,
    lines,
    totalIncVatNok: total,
    exVatNok: exVat,
    vatNok: roundNok(total - exVat),
  };
}

export function receiptFilename(number: string) {
  return `Kvittering ${number}.pdf`;
}

export function buildReceiptEmail(input: { number: string; orderNumber: string; customerName: string; amountIncVatNok: number }) {
  const greeting = escapeHtml(input.customerName.trim() || "kunde");
  return {
    subject: `Kvittering ${input.number} for ordre ${input.orderNumber}`,
    html: buildSimpleEmailShell(`
      <p style="margin:0 0 16px 0;">Hei ${greeting},</p>
      <p style="margin:0 0 16px 0;">
        Takk for betalingen! Vi har mottatt <strong>${escapeHtml(formatKr(input.amountIncVatNok))}</strong> for ordre ${escapeHtml(input.orderNumber)}.
        Kvitteringen er vedlagt.
      </p>
      <p style="margin:16px 0 0 0;">Har du spørsmål? Bare svar på denne e-posten.</p>
    `),
  };
}
