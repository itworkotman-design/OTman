import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildWebSalesReport, type ReportPayment } from "./webSalesReport";
import { renderWebSalesReportPdf } from "./webSalesReportPdf";

const payment = (n: number): ReportPayment => ({
  id: `p${n}`,
  receiptNumber: n,
  createdAt: new Date("2026-11-04T09:30:00Z"),
  amountChargedCents: 373000,
  stripePaymentIntentId: `pi_${n}`,
  orderNumber: String(20000 + n),
  customerName: "Kari Nordmann – Ålesund",
});
const report = (count: number) =>
  buildWebSalesReport({
    period: "2026-11",
    payments: Array.from({ length: count }, (_, i) => payment(i + 1)),
    refunds: [
      {
        id: "r1",
        receiptNumber: count + 1,
        createdAt: new Date("2026-11-06T12:00:00Z"),
        amountRefundedCents: 50000,
        stripeRefundId: "re_1",
        creditsReceiptNumber: 1,
        orderNumber: "20001",
        customerName: "Kari Nordmann",
      },
    ],
    stripe: { byPaymentIntent: new Map(), byRefund: new Map(), payoutsInMonth: [{ id: "po_1", arrivalDate: "2026-11-09", amountNok: 3000, status: "paid" }] },
  });

describe("renderWebSalesReportPdf — the report as a printable PDF", () => {
  it("is a landscape A4 PDF titled with the period", async () => {
    const doc = await PDFDocument.load(await renderWebSalesReportPdf(report(3), { createdAt: new Date("2026-12-02T10:00:00Z") }));
    expect(doc.getTitle()).toBe("Nettsalg W-serie 2026-11");
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
  });

  it("continues on new pages when the documents don't fit", async () => {
    const doc = await PDFDocument.load(await renderWebSalesReportPdf(report(80), { createdAt: new Date(), stripeUnavailable: true }));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
