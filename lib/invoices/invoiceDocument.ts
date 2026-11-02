import { formatKr } from "@/lib/orders/orderChangeText";
import { buildSimpleEmailShell, escapeHtml } from "@/lib/orders/customerLifecycleEmails";
import { invoiceCalculatorLines, invoiceNumber, type InvoiceEntry } from "@/lib/orders/manualPayments";
import { parseOrderStateSnapshot } from "@/lib/orders/paidOrderSnapshot";
import type { InvoiceCustomer, InvoiceDocumentEntry, InvoiceSeller } from "./invoicePdf";

// What sendOrderInvoice needs around the PDF (invoicePdf.ts): the seller's
// details, who's billed, the stored fakturas as the file's entries, and the
// email the PDF goes out with.

export const DEFAULT_INVOICE_DUE_DAYS = 14;

// INVOICE_* env vars; null when a faktura can't be made (no seller name or
// bank account to pay to).
export function invoiceSellerFromEnv(env: Record<string, string | undefined> = process.env): { seller: InvoiceSeller; dueDays: number } | null {
  const name = env.INVOICE_SELLER_NAME?.trim();
  const bankAccount = env.INVOICE_BANK_ACCOUNT?.trim();
  if (!name || !bankAccount) return null;
  const dueDays = Number.parseInt(env.INVOICE_DUE_DAYS ?? "", 10);
  return {
    seller: {
      name,
      orgNumber: env.INVOICE_ORG_NUMBER?.trim() ?? "",
      address: env.INVOICE_ADDRESS?.trim() ?? "",
      bankAccount,
      email: env.INVOICE_EMAIL?.trim() ?? "",
    },
    dueDays: Number.isFinite(dueDays) && dueDays > 0 ? dueDays : DEFAULT_INVOICE_DUE_DAYS,
  };
}

export function invoiceCustomer(order: {
  customerName: string | null;
  customerLabel: string | null;
  email: string | null;
  deliveryAddress: string | null;
  pickupAddress: string | null;
  websiteBookingDetails: unknown;
}): InvoiceCustomer {
  const details = (order.websiteBookingDetails && typeof order.websiteBookingDetails === "object" ? order.websiteBookingDetails : {}) as Record<string, unknown>;
  const orgNumber = details.customerType === "business" && typeof details.orgNumber === "string" && details.orgNumber.trim() ? details.orgNumber.trim() : null;
  return {
    name: order.customerName?.trim() || order.customerLabel?.trim() || "",
    address: order.deliveryAddress?.trim() || order.pickupAddress?.trim() || "",
    orgNumber,
    email: order.email?.trim() ?? "",
  };
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export function invoiceDueDate(issuedAt: Date, dueDays: number) {
  return addDays(issuedAt, dueDays);
}

// The stored entries (oldest first) as the PDF's entries: each faktura's
// calculator page lists what changed since the one before it.
export function invoiceDocumentEntries(displayId: number, entries: InvoiceEntry[], options: { dueDays: number }): InvoiceDocumentEntry[] {
  const sorted = [...entries].sort((a, b) => a.sequence - b.sequence);
  let previous = null as ReturnType<typeof parseOrderStateSnapshot>;
  return sorted.map((entry) => {
    const snapshot = parseOrderStateSnapshot(entry.orderSnapshot);
    const lines = snapshot && entry.kind === "invoice" ? invoiceCalculatorLines(previous, snapshot) : [];
    if (snapshot) previous = snapshot;
    return {
      number: invoiceNumber(displayId, entry),
      kind: entry.kind,
      issuedAt: entry.createdAt,
      dueDate: invoiceDueDate(entry.createdAt, options.dueDays),
      amountIncVatNok: entry.amountCents / 100,
      paid: entry.paidAt !== null,
      calculatorLines: lines,
    };
  });
}

const formatDate = (date: Date) => date.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });

export function invoiceFilename(kind: InvoiceEntry["kind"], number: string) {
  return `${kind === "refund" ? "Kreditnota" : "Faktura"} ${number}.pdf`;
}

export function buildInvoiceEmail(input: {
  kind: InvoiceEntry["kind"];
  number: string;
  displayId: number;
  customerName: string;
  amountIncVatNok: number;
  dueDate: Date;
  bankAccount: string;
}) {
  const greeting = escapeHtml(input.customerName.trim() || "kunde");
  if (input.kind === "refund") {
    return {
      subject: `Kreditnota ${input.number} for ordre ${input.displayId}`,
      html: buildSimpleEmailShell(`
        <p style="margin:0 0 16px 0;">Hei ${greeting},</p>
        <p style="margin:0 0 16px 0;">
          Bestillingen din (ordre ${input.displayId}) ble rimeligere enn det du har betalt.
          Vedlagt er kreditnota ${escapeHtml(input.number)} på <strong>${escapeHtml(formatKr(input.amountIncVatNok))}</strong>, som vi betaler tilbake til deg.
        </p>
        <p style="margin:16px 0 0 0;">Har du spørsmål? Bare svar på denne e-posten.</p>
      `),
    };
  }
  return {
    subject: `Faktura ${input.number} for ordre ${input.displayId}`,
    html: buildSimpleEmailShell(`
      <p style="margin:0 0 16px 0;">Hei ${greeting},</p>
      <p style="margin:0 0 16px 0;">
        Vedlagt er faktura ${escapeHtml(input.number)} for ordre ${input.displayId}.
      </p>
      <p style="margin:0 0 16px 0;">
        Å betale: <strong>${escapeHtml(formatKr(input.amountIncVatNok))}</strong><br/>
        Forfallsdato: <strong>${formatDate(input.dueDate)}</strong><br/>
        Kontonummer: <strong>${escapeHtml(input.bankAccount)}</strong><br/>
        Merk betalingen med: <strong>${escapeHtml(input.number)}</strong>
      </p>
      <p style="margin:16px 0 0 0;">Har du spørsmål? Bare svar på denne e-posten.</p>
    `),
  };
}
