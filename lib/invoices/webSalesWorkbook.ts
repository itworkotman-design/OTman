import ExcelJS from "exceljs";
import type { WebSalesReport } from "./webSalesReport";

// The monthly web-sales report (webSalesReport.ts) as an Excel file for the
// accountant, in Norwegian: "Sammendrag" (the totals the month's voucher is
// posted from, and the Stripe clearing-account check), "Bilag" (every
// receipt and credit note) and "Utbetalinger" (Stripe's payouts to the bank).

const NOK_FORMAT = "#,##0.00";

export function webSalesReportFilename(period: string, format: "xlsx" | "pdf" = "xlsx") {
  return `Nettsalg W-serie ${period}.${format}`;
}

const formatDateTime = (date: Date) =>
  date.toLocaleString("nb-NO", { timeZone: "Europe/Oslo", dateStyle: "short", timeStyle: "short" });

export async function buildWebSalesWorkbook(
  report: WebSalesReport,
  options: { createdAt: Date; stripeUnavailable?: boolean },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const { totals } = report;

  const summary = workbook.addWorksheet("Sammendrag");
  summary.columns = [{ width: 52 }, { width: 16 }, { width: 16 }, { width: 16 }];
  summary.addRow([`Nettsalg betalt med kort (Stripe), W-serien – ${report.period}`]).font = { bold: true, size: 14 };
  summary.addRow([`Laget ${formatDateTime(options.createdAt)}. Beløp i NOK.`]);
  if (options.stripeUnavailable) {
    summary.addRow(["OBS: Stripe kunne ikke nås da rapporten ble laget – utbetalinger og gebyrer mangler. Last ned rapporten på nytt senere."]).font = {
      bold: true,
      color: { argb: "FFB00020" },
    };
  }
  summary.addRow([]);
  summary.addRow(["Bilag i perioden", "Inkl. mva", "Eks. mva", "Mva 25 %"]).font = { bold: true };
  for (const [label, amounts] of [
    ["Salg (kvitteringer)", totals.sales],
    ["Tilbakebetalinger (kreditnotaer)", totals.refunds],
    ["Netto", totals.net],
  ] as const) {
    const row = summary.addRow([label, amounts.incVatNok, amounts.exVatNok, amounts.vatNok]);
    if (label === "Netto") row.font = { bold: true };
  }
  summary.addRow([]);
  summary.addRow(["Stripe", "Beløp"]).font = { bold: true };
  summary.addRow(["Utbetalt fra Stripe til bank i perioden", totals.payoutsNok]);
  summary.addRow(["Stripe-gebyrer på periodens betalinger (se Stripes fakturaer)", totals.feesNok]);
  summary.addRow(["Ikke utbetalt fra Stripe da rapporten ble laget", totals.notPaidOutNok]);
  summary.addRow([]);
  summary.addRow([`Antall bilag: ${report.rows.length}. Bilag uten utbetaling er merket «Ikke utbetalt» på arket Bilag.`]);
  for (const column of [2, 3, 4]) summary.getColumn(column).numFmt = NOK_FORMAT;

  const documents = workbook.addWorksheet("Bilag");
  documents.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Nr.", key: "number", width: 16 },
    { header: "Dato", key: "date", width: 12 },
    { header: "Ordre", key: "orderNumber", width: 10 },
    { header: "Kunde", key: "customer", width: 26 },
    { header: "Eks. mva", key: "exVatNok", width: 12 },
    { header: "Mva 25 %", key: "vatNok", width: 12 },
    { header: "Inkl. mva", key: "incVatNok", width: 12 },
    { header: "Gjelder kvittering", key: "credits", width: 18 },
    { header: "Stripe-referanse", key: "stripeRef", width: 30 },
    { header: "Stripe-utbetaling", key: "payoutId", width: 32 },
    { header: "Utbetalt dato", key: "payoutDate", width: 14 },
    { header: "Stripe-gebyr", key: "feeNok", width: 12 },
  ];
  documents.getRow(1).font = { bold: true };
  for (const row of report.rows) {
    documents.addRow({ ...row, credits: row.credits ?? "", payoutId: row.payoutId ?? "Ikke utbetalt", payoutDate: row.payoutDate ?? "", feeNok: row.feeNok ?? "" });
  }
  for (const key of ["exVatNok", "vatNok", "incVatNok", "feeNok"]) documents.getColumn(key).numFmt = NOK_FORMAT;
  documents.views = [{ state: "frozen", ySplit: 1 }];

  const payouts = workbook.addWorksheet("Utbetalinger");
  payouts.columns = [
    { header: "Stripe-utbetaling", key: "id", width: 32 },
    { header: "Dato i bank", key: "arrivalDate", width: 14 },
    { header: "Beløp", key: "amountNok", width: 14 },
    { header: "Status", key: "status", width: 12 },
  ];
  payouts.getRow(1).font = { bold: true };
  for (const payout of report.payouts) payouts.addRow(payout);
  payouts.getColumn("amountNok").numFmt = NOK_FORMAT;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
