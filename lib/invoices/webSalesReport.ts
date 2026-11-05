import { getOsloDateKey, osloWallClockToDate } from "@/lib/dates/isoDate";
import { roundNok } from "@/lib/orders/orderTotals";
import { formatReceiptNumber } from "./receiptSeries";

// The monthly web-sales report for the accountant (option A: the W-series is
// posted to PowerOffice as one voucher a month). Every receipt (Stripe
// payment) and credit note (Stripe refund) of the month in Oslo time, with
// the VAT split exactly as on the documents, which Stripe payout each one went
// out in, and the totals the voucher is posted from. Pure: the data comes
// from webSalesReportData.ts, the Excel file from webSalesWorkbook.ts.

export type ReportMonth = { month: string; from: Date; to: Date };

// "YYYY-MM" → the month's start and end (exclusive) as Oslo midnights.
export function parseReportMonth(value: string | null | undefined): ReportMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  return {
    month: `${match[1]}-${match[2]}`,
    from: osloWallClockToDate(`${match[1]}-${match[2]}-01`, "00:00"),
    to: osloWallClockToDate(`${next}-01`, "00:00"),
  };
}

export type ReportPayment = {
  id: string;
  receiptNumber: number | null;
  createdAt: Date;
  amountChargedCents: number;
  stripePaymentIntentId: string | null;
  orderNumber: string;
  customerName: string;
};

export type ReportRefund = {
  id: string;
  receiptNumber: number | null;
  createdAt: Date;
  amountRefundedCents: number;
  stripeRefundId: string;
  // The receipt of the payment it pays back.
  creditsReceiptNumber: number | null;
  orderNumber: string;
  customerName: string;
};

// Where Stripe settled a charge or refund (lib/stripe/payoutLookup.ts).
export type StripeSettlement = { payoutId: string; payoutDate: string; feeNok: number };
export type StripePayout = { id: string; arrivalDate: string; amountNok: number; status: string };
export type StripeSettlementLookup = {
  byPaymentIntent: Map<string, StripeSettlement>;
  byRefund: Map<string, StripeSettlement>;
  // Payouts that reached the bank this month — what the bank statement shows.
  payoutsInMonth: StripePayout[];
};

export type WebSalesReportRow = {
  type: "Kvittering" | "Kreditnota";
  number: string;
  date: string;
  orderNumber: string;
  customer: string;
  incVatNok: number;
  exVatNok: number;
  vatNok: number;
  // A credit note: the receipt it credits.
  credits: string | null;
  // The Stripe payment intent (receipt) or refund (credit note).
  stripeRef: string;
  payoutId: string | null;
  payoutDate: string | null;
  feeNok: number | null;
};

type Amounts = { incVatNok: number; exVatNok: number; vatNok: number };

export type WebSalesReport = {
  month: string;
  rows: WebSalesReportRow[];
  // Rows Stripe hasn't paid out yet (when the report was made).
  notPaidOut: WebSalesReportRow[];
  payouts: StripePayout[];
  totals: {
    sales: Amounts;
    refunds: Amounts;
    net: Amounts;
    feesNok: number;
    notPaidOutNok: number;
    payoutsNok: number;
  };
};

const MISSING_NUMBER = "Mangler nummer";

// The same split as the receipt (receiptDocument.ts): VAT is 25 % of the
// charged amount, rounded per document.
function split(incVatNok: number): Amounts {
  const exVatNok = roundNok(incVatNok / 1.25);
  return { incVatNok, exVatNok, vatNok: roundNok(incVatNok - exVatNok) };
}

const sum = (values: number[]) => roundNok(values.reduce((total, value) => total + value, 0));
const sumAmounts = (rows: Amounts[]): Amounts => ({
  incVatNok: sum(rows.map((row) => row.incVatNok)),
  exVatNok: sum(rows.map((row) => row.exVatNok)),
  vatNok: sum(rows.map((row) => row.vatNok)),
});

export function buildWebSalesReport(input: {
  month: string;
  payments: ReportPayment[];
  refunds: ReportRefund[];
  stripe: StripeSettlementLookup;
}): WebSalesReport {
  const settled = (settlement: StripeSettlement | undefined) => ({
    payoutId: settlement?.payoutId ?? null,
    payoutDate: settlement?.payoutDate ?? null,
    feeNok: settlement?.feeNok ?? null,
  });

  const receipts = input.payments.map((payment) => ({
    sortKey: payment.receiptNumber ?? Number.MAX_SAFE_INTEGER,
    row: {
      type: "Kvittering" as const,
      number: payment.receiptNumber ? formatReceiptNumber(payment.receiptNumber) : MISSING_NUMBER,
      date: getOsloDateKey(payment.createdAt),
      orderNumber: payment.orderNumber,
      customer: payment.customerName,
      ...split(roundNok(payment.amountChargedCents / 100)),
      credits: null,
      stripeRef: payment.stripePaymentIntentId ?? "",
      ...settled(payment.stripePaymentIntentId ? input.stripe.byPaymentIntent.get(payment.stripePaymentIntentId) : undefined),
    },
  }));
  const creditNotes = input.refunds.map((refund) => ({
    sortKey: refund.receiptNumber ?? Number.MAX_SAFE_INTEGER,
    row: {
      type: "Kreditnota" as const,
      number: refund.receiptNumber ? formatReceiptNumber(refund.receiptNumber) : MISSING_NUMBER,
      date: getOsloDateKey(refund.createdAt),
      orderNumber: refund.orderNumber,
      customer: refund.customerName,
      ...split(-roundNok(refund.amountRefundedCents / 100)),
      credits: refund.creditsReceiptNumber ? formatReceiptNumber(refund.creditsReceiptNumber) : null,
      stripeRef: refund.stripeRefundId,
      ...settled(input.stripe.byRefund.get(refund.stripeRefundId)),
    },
  }));

  const rows = [...receipts, ...creditNotes]
    .sort((a, b) => a.sortKey - b.sortKey || a.row.date.localeCompare(b.row.date))
    .map((entry) => entry.row);
  const notPaidOut = rows.filter((row) => !row.payoutId);
  const sales = sumAmounts(rows.filter((row) => row.type === "Kvittering"));
  const refunds = sumAmounts(rows.filter((row) => row.type === "Kreditnota"));

  return {
    month: input.month,
    rows,
    notPaidOut,
    payouts: input.stripe.payoutsInMonth,
    totals: {
      sales,
      refunds,
      net: sumAmounts([sales, refunds]),
      feesNok: sum(rows.map((row) => row.feeNok ?? 0)),
      notPaidOutNok: sum(notPaidOut.map((row) => row.incVatNok)),
      payoutsNok: sum(input.stripe.payoutsInMonth.map((payout) => payout.amountNok)),
    },
  };
}
