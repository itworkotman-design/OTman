import { roundNok } from "./orderTotals";
import {
  diffOrderStates,
  parseOrderStateSnapshot,
  type OrderDetailChange,
  type OrderLineChange,
  type OrderStateSnapshot,
} from "./paidOrderSnapshot";
import { normalizeOrderStatus } from "./statusPresentation";

// Manual payments for homepage orders while Stripe isn't connected: staff
// send fakturas (OrderInvoice rows) and mark them paid by hand. This is the
// pure ledger: what's been invoiced and paid, how the order now compares to
// the latest faktura, and the order's payment status. Amounts are what the
// customer pays (incl. VAT), the same as paidOrderSnapshot.ts.

// refund_pending: paid by Stripe, but the order has since got cheaper than
// what was paid — staff owe a refund (lib/orders/stripePaymentOverview.ts).
export type PaymentStatus = "pending" | "paid" | "refund_pending";
export type InvoiceKind = "invoice" | "refund";

export type InvoiceEntry = {
  // 1, 2, 3… per order — the faktura number's suffix (invoiceNumber).
  sequence: number;
  // "refund" = a kreditnota: money owed back to the customer.
  kind: InvoiceKind;
  // Always positive; `kind` gives the sign.
  amountCents: number;
  // The order total (incl. VAT) this entry brought the order up to.
  totalAfterCents: number;
  // buildOrderStateSnapshot when it was sent.
  orderSnapshot: unknown;
  paidAt: Date | null;
  createdAt: Date;
};

export type InvoiceLedgerOutcome = "none" | "invoice_pending" | "paid" | "due_more" | "owe_refund";

export type InvoiceLedger = {
  outcome: InvoiceLedgerOutcome;
  // Fakturas minus kreditnotas.
  invoicedIncVatNok: number;
  // Paid fakturas minus kreditnotas (a recorded refund is money already settled).
  paidIncVatNok: number;
  currentIncVatNok: number;
  // current − invoiced: positive = send another faktura, negative = owed back.
  differenceIncVatNok: number;
  // What changed since the latest entry's snapshot.
  lineChanges: OrderLineChange[];
  detailChanges: OrderDetailChange[];
};

// The faktura number is the order's ID: 1042, then 1042-2, 1042-3…; a
// kreditnota is 1042-K2.
export function invoiceNumber(displayId: number, entry: Pick<InvoiceEntry, "sequence" | "kind">): string {
  if (entry.kind === "refund") return `${displayId}-K${entry.sequence}`;
  return entry.sequence <= 1 ? String(displayId) : `${displayId}-${entry.sequence}`;
}

const signedCents = (entry: InvoiceEntry) => (entry.kind === "refund" ? -entry.amountCents : entry.amountCents);

export function invoiceLedger(entries: InvoiceEntry[], current: OrderStateSnapshot): InvoiceLedger {
  const invoices = entries.filter((entry) => entry.kind === "invoice");
  const refunds = entries.filter((entry) => entry.kind === "refund");
  const refundedCents = refunds.reduce((sum, entry) => sum + entry.amountCents, 0);
  const invoicedCents = entries.reduce((sum, entry) => sum + signedCents(entry), 0);
  const paidCents = invoices.filter((entry) => entry.paidAt).reduce((sum, entry) => sum + entry.amountCents, 0) - refundedCents;

  const invoicedIncVatNok = roundNok(invoicedCents / 100);
  const differenceIncVatNok = roundNok(current.totalIncVatNok - invoicedIncVatNok);
  const allPaid = invoices.every((entry) => entry.paidAt);

  const outcome: InvoiceLedgerOutcome =
    entries.length === 0
      ? "none"
      : differenceIncVatNok > 0
        ? "due_more"
        : differenceIncVatNok < 0
          ? "owe_refund"
          : allPaid
            ? "paid"
            : "invoice_pending";

  const latest = [...entries]
    .sort((a, b) => b.sequence - a.sequence)
    .map((entry) => parseOrderStateSnapshot(entry.orderSnapshot))
    .find((snapshot): snapshot is OrderStateSnapshot => snapshot !== null);
  const changes = latest ? diffOrderStates(latest, current) : { lineChanges: [], detailChanges: [] };

  return {
    outcome,
    invoicedIncVatNok,
    paidIncVatNok: roundNok(paidCents / 100),
    currentIncVatNok: current.totalIncVatNok,
    differenceIncVatNok,
    lineChanges: changes.lineChanges,
    detailChanges: changes.detailChanges,
  };
}

// The order's payment status after any change: none before the first
// faktura; "paid" only when every faktura is marked paid (the Mark paid
// button) and the total still matches what was invoiced; otherwise pending.
export function nextPaymentStatus(entries: InvoiceEntry[], currentTotalIncVatNok: number): PaymentStatus | null {
  if (entries.length === 0) return null;
  const invoicedIncVatNok = roundNok(entries.reduce((sum, entry) => sum + signedCents(entry), 0) / 100);
  const allPaid = entries.filter((entry) => entry.kind === "invoice").every((entry) => entry.paidAt);
  return allPaid && roundNok(currentTotalIncVatNok) === invoicedIncVatNok ? "paid" : "pending";
}

export type InvoiceCalculatorLine = { group: string; label: string; qty: number; price: number };

// A faktura's calculator page: the first faktura lists every line; a
// follow-up only what changed since the previous one (a changed line as its
// difference, a removed one negative).
export function invoiceCalculatorLines(previous: OrderStateSnapshot | null, current: OrderStateSnapshot): InvoiceCalculatorLine[] {
  if (!previous) return current.lines.map(({ group, label, qty, price }) => ({ group, label, qty, price }));
  return diffOrderStates(previous, current).lineChanges.map((change) => ({
    group: change.group,
    label: change.label,
    qty: change.kind === "removed" ? change.qtyBefore : change.qtyAfter,
    price: change.delta,
  }));
}

export type GsmReadinessReason = "NOT_CONFIRMED" | "NOT_PAID";

// A homepage order should reach GSM confirmed and paid. It can still be sent;
// these reasons are what the booking list warns about first.
export function gsmReadiness(order: {
  websiteOrderKind: string | null;
  status: string | null;
  paymentStatus: string | null;
}): GsmReadinessReason[] {
  if (!order.websiteOrderKind) return [];
  const reasons: GsmReadinessReason[] = [];
  if (normalizeOrderStatus(order.status) !== "confirmed") reasons.push("NOT_CONFIRMED");
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "refund_pending") reasons.push("NOT_PAID");
  return reasons;
}

// The question the booking list asks before sending to GSM: which homepage
// orders aren't confirmed and paid yet. Null when they all are.
export function gsmNotReadyWarning(
  orders: { displayId: number; websiteOrderKind?: string | null; status: string | null; paymentStatus?: string | null }[],
): string | null {
  const lines = orders.flatMap((order) => {
    const reasons = gsmReadiness({
      websiteOrderKind: order.websiteOrderKind ?? null,
      status: order.status,
      paymentStatus: order.paymentStatus ?? null,
    });
    if (reasons.length === 0) return [];
    const what = reasons.map((reason) => (reason === "NOT_CONFIRMED" ? "not confirmed" : "not paid")).join(" and ");
    return [`Order ${order.displayId} is ${what}.`];
  });
  return lines.length > 0 ? `${lines.join("\n")}\n\nSend to GSM anyway?` : null;
}
