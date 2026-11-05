import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildWebSalesReport } from "./webSalesReport";
import { buildWebSalesWorkbook, webSalesReportFilename } from "./webSalesWorkbook";

const report = buildWebSalesReport({
  month: "2026-11",
  payments: [
    {
      id: "p1",
      receiptNumber: 7,
      createdAt: new Date("2026-11-04T09:30:00Z"),
      amountChargedCents: 373000,
      stripePaymentIntentId: "pi_1",
      orderNumber: "20049",
      customerName: "Kari Nordmann",
    },
  ],
  refunds: [
    {
      id: "r1",
      receiptNumber: 8,
      createdAt: new Date("2026-11-06T12:00:00Z"),
      amountRefundedCents: 50000,
      stripeRefundId: "re_1",
      creditsReceiptNumber: 7,
      orderNumber: "20049",
      customerName: "Kari Nordmann",
    },
  ],
  stripe: {
    byPaymentIntent: new Map([["pi_1", { payoutId: "po_1", payoutDate: "2026-11-09", feeNok: 63.6 }]]),
    byRefund: new Map(),
    payoutsInMonth: [{ id: "po_1", arrivalDate: "2026-11-09", amountNok: 3666.4, status: "paid" }],
  },
});

async function load(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

describe("buildWebSalesWorkbook — the Excel file for the accountant", () => {
  it("has a summary, every document, and the Stripe payouts", async () => {
    const workbook = await load(await buildWebSalesWorkbook(report, { createdAt: new Date("2026-12-02T10:00:00Z") }));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Sammendrag", "Bilag", "Utbetalinger"]);
  });

  it("puts the voucher totals on the summary", async () => {
    const sheet = (await load(await buildWebSalesWorkbook(report, { createdAt: new Date() }))).getWorksheet("Sammendrag")!;
    const values = sheet.getSheetValues().flat().filter((value) => value !== undefined && value !== null);
    expect(values).toEqual(expect.arrayContaining(["Salg (kvitteringer)", 3730, 2984, 746]));
    expect(values).toEqual(expect.arrayContaining(["Tilbakebetalinger (kreditnotaer)", -500, -400, -100]));
    expect(values).toEqual(expect.arrayContaining(["Netto", 3230, 2584, 646]));
  });

  it("lists each document with its number, amounts, and Stripe payout", async () => {
    const sheet = (await load(await buildWebSalesWorkbook(report, { createdAt: new Date() }))).getWorksheet("Bilag")!;
    expect(sheet.getRow(1).getCell(1).value).toBe("Type");
    expect(sheet.getRow(2).values).toEqual(
      expect.arrayContaining(["Kvittering", "W-7", "2026-11-04", "20049", "Kari Nordmann", 2984, 746, 3730, "pi_1", "po_1", "2026-11-09", 63.6]),
    );
    expect(sheet.getRow(3).values).toEqual(expect.arrayContaining(["Kreditnota", "W-8", "W-7", -500, "re_1", "Ikke utbetalt"]));
  });

  it("warns on the summary when Stripe couldn't be reached", async () => {
    const sheet = (await load(await buildWebSalesWorkbook(report, { createdAt: new Date(), stripeUnavailable: true }))).getWorksheet("Sammendrag")!;
    const text = sheet.getSheetValues().flat().filter((value) => typeof value === "string").join(" ");
    expect(text).toContain("Stripe kunne ikke nås");
  });

  it("names the file after the month", () => {
    expect(webSalesReportFilename("2026-11")).toBe("Nettsalg W-serie 2026-11.xlsx");
  });
});
