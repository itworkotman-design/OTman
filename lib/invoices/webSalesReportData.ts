import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { fetchStripeSettlements } from "@/lib/stripe/payoutLookup";
import { buildWebSalesReport, type ReportMonth, type StripeSettlementLookup, type WebSalesReport } from "./webSalesReport";

// Loads the monthly web-sales report (webSalesReport.ts) for one company:
// its Stripe payments (receipts) and refunds (credit notes) dated in the
// month, plus Stripe's payouts (lib/stripe/payoutLookup.ts). When Stripe
// can't be reached the report is still made, without payouts and fees.

type ReportOrder = { displayId: number; orderNumber: string | null; customerName: string | null; customerLabel: string | null };
const ORDER_SELECT = { select: { displayId: true, orderNumber: true, customerName: true, customerLabel: true } } as const;

const orderNumber = (order: ReportOrder) => order.orderNumber?.trim() || String(order.displayId);
const customerName = (order: ReportOrder) => order.customerName?.trim() || order.customerLabel?.trim() || "";

export async function loadWebSalesReport(input: {
  companyId: string;
  month: ReportMonth;
}): Promise<{ report: WebSalesReport; stripeUnavailable: boolean }> {
  const where = { companyId: input.companyId, createdAt: { gte: input.month.from, lt: input.month.to } };
  const [payments, refunds] = await Promise.all([
    prisma.orderPayment.findMany({
      where,
      select: { id: true, receiptNumber: true, createdAt: true, amountChargedCents: true, stripePaymentIntentId: true, order: ORDER_SELECT },
    }),
    prisma.orderRefund.findMany({
      where,
      select: {
        id: true,
        receiptNumber: true,
        createdAt: true,
        amountRefundedCents: true,
        stripeRefundId: true,
        orderPayment: { select: { receiptNumber: true } },
        order: ORDER_SELECT,
      },
    }),
  ]);

  let stripe: StripeSettlementLookup = { byPaymentIntent: new Map(), byRefund: new Map(), payoutsInMonth: [] };
  let stripeUnavailable = false;
  try {
    stripe = await fetchStripeSettlements(getStripeClient(), { from: input.month.from, to: input.month.to });
  } catch (error) {
    console.error("[web-sales-report] Could not read Stripe payouts", error);
    stripeUnavailable = true;
  }

  const report = buildWebSalesReport({
    month: input.month.month,
    payments: payments.map(({ order, ...payment }) => ({ ...payment, orderNumber: orderNumber(order), customerName: customerName(order) })),
    refunds: refunds.map(({ order, orderPayment, ...refund }) => ({
      ...refund,
      creditsReceiptNumber: orderPayment.receiptNumber,
      orderNumber: orderNumber(order),
      customerName: customerName(order),
    })),
    stripe,
  });
  return { report, stripeUnavailable };
}
