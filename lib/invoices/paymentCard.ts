import { roundNok } from "@/lib/orders/orderTotals";

// What the Payment card in the homepage order modal says and offers (manual
// fakturas, lib/invoices/orderInvoices.ts). previewTotalIncVatNok is the
// calculator's unsaved total: the card follows it live ("after this change"),
// but only a saved order can be invoiced, so no button works until then.

export type PaymentCardHeadline = "not_priced" | "not_invoiced" | "pending" | "paid" | "due_more" | "owe_refund";

export type PaymentCardState = {
  headline: PaymentCardHeadline;
  // Every faktura sent is marked paid (and there is at least one).
  allPaid: boolean;
  invoicedIncVatNok: number;
  paidIncVatNok: number;
  totalIncVatNok: number;
  // total − invoiced: + another faktura, − owed back.
  differenceIncVatNok: number;
  // Showing the calculator's unsaved total.
  afterChange: boolean;
  actions: { sendInvoiceCents: number | null; recordRefundCents: number | null; markPaid: boolean };
};

export function paymentCardState(
  overview: {
    invoices: { kind: "invoice" | "refund"; amountIncVatNok: number; paidAt: string | null }[];
    ledger: { invoicedIncVatNok: number; paidIncVatNok: number; currentIncVatNok: number };
  },
  previewTotalIncVatNok: number | null,
): PaymentCardState {
  const afterChange = previewTotalIncVatNok !== null && roundNok(previewTotalIncVatNok) !== roundNok(overview.ledger.currentIncVatNok);
  const totalIncVatNok = afterChange ? roundNok(previewTotalIncVatNok!) : overview.ledger.currentIncVatNok;
  const { invoicedIncVatNok, paidIncVatNok } = overview.ledger;
  const differenceIncVatNok = roundNok(totalIncVatNok - invoicedIncVatNok);
  const fakturas = overview.invoices.filter((entry) => entry.kind === "invoice");
  const anyUnpaid = fakturas.some((entry) => !entry.paidAt);
  const allPaid = fakturas.length > 0 && !anyUnpaid;

  const headline: PaymentCardHeadline =
    overview.invoices.length === 0
      ? totalIncVatNok > 0
        ? "not_invoiced"
        : "not_priced"
      : differenceIncVatNok > 0
        ? "due_more"
        : differenceIncVatNok < 0
          ? "owe_refund"
          : allPaid
            ? "paid"
            : "pending";

  const cents = Math.round(Math.abs(differenceIncVatNok) * 100);
  return {
    headline,
    allPaid,
    invoicedIncVatNok,
    paidIncVatNok,
    totalIncVatNok,
    differenceIncVatNok,
    afterChange,
    actions: afterChange
      ? { sendInvoiceCents: null, recordRefundCents: null, markPaid: false }
      : {
          sendInvoiceCents: differenceIncVatNok > 0 ? cents : null,
          recordRefundCents: differenceIncVatNok < 0 && overview.invoices.length > 0 ? cents : null,
          markPaid: anyUnpaid,
        },
  };
}
