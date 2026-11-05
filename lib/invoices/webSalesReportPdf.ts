import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { WebSalesReport } from "./webSalesReport";

// The web-sales report (webSalesReport.ts) as a printable landscape A4 PDF —
// the same content as the Excel file (webSalesWorkbook.ts): the summary the
// voucher is posted from, every receipt and credit note, and Stripe's payouts.

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const BLUE = rgb(0.153, 0.188, 0.592); // #273097
const RED = rgb(0.69, 0, 0.13);
const TEXT = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);
const ROW = 13;

// nb-NO writes negatives with U+2212, which WinAnsi can't draw.
const formatNok = (amount: number) =>
  amount
    .toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/ | /g, " ")
    .replace(/−/g, "-");
const formatDateTime = (date: Date) =>
  date.toLocaleString("nb-NO", { timeZone: "Europe/Oslo", dateStyle: "short", timeStyle: "short" });

// The standard fonts are WinAnsi: keep Latin-1 (æøå) and the usual marks.
const safe = (text: string) => text.replace(/[^\x20-\x7e\xa0-\xff–—‘’“”…€•]/g, "?");

type Column = { title: string; width: number; align?: "right" };

const DOCUMENT_COLUMNS: Column[] = [
  { title: "Type", width: 62 },
  { title: "Nr.", width: 48 },
  { title: "Dato", width: 58 },
  { title: "Ordre", width: 44 },
  { title: "Kunde", width: 120 },
  { title: "Eks. mva", width: 62, align: "right" },
  { title: "Mva", width: 54, align: "right" },
  { title: "Inkl. mva", width: 64, align: "right" },
  { title: "Gjelder", width: 44 },
  { title: "Stripe-utbetaling", width: 140 },
  { title: "Utbetalt", width: 58 },
  { title: "Gebyr", width: 0, align: "right" },
];

export async function renderWebSalesReportPdf(
  report: WebSalesReport,
  options: { createdAt: Date; stripeUnavailable?: boolean },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Nettsalg W-serie ${report.period}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const fit = (value: string, width: number, useFont: PDFFont, size: number) => {
    let text = safe(value);
    if (width <= 0) return text;
    while (text.length > 1 && useFont.widthOfTextAtSize(text, size) > width - 4) text = text.slice(0, -1);
    return text.length < safe(value).length ? `${text.slice(0, -1)}…` : text;
  };
  const write = (value: string, x: number, size = 9, useFont: PDFFont = font, color = TEXT) =>
    page.drawText(safe(value), { x, y, size, font: useFont, color });
  const writeRight = (value: string, xRight: number, size = 9, useFont: PDFFont = font, color = TEXT) =>
    page.drawText(safe(value), { x: xRight - useFont.widthOfTextAtSize(safe(value), size), y, size, font: useFont, color });

  // Lays out a row of cells; the last column takes what's left of the width.
  const drawRow = (columns: Column[], cells: string[], useFont: PDFFont = font, color = TEXT) => {
    let x = MARGIN;
    columns.forEach((column, index) => {
      const width = column.width || PAGE_WIDTH - MARGIN - x;
      const value = fit(cells[index] ?? "", width, useFont, 8.5);
      if (column.align === "right") writeRight(value, x + width - 4, 8.5, useFont, color);
      else write(value, x, 8.5, useFont, color);
      x += width;
    });
    y -= ROW;
  };
  const rule = () => {
    page.drawLine({ start: { x: MARGIN, y: y + ROW - 3 }, end: { x: PAGE_WIDTH - MARGIN, y: y + ROW - 3 }, thickness: 0.5, color: MUTED });
  };
  // A new page when fewer than `needed` points are left (with the table header again).
  const ensure = (needed: number, header?: () => void) => {
    if (y - needed >= MARGIN) return;
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    header?.();
  };

  // Title and summary.
  write(`Nettsalg betalt med kort (Stripe), W-serien – ${report.period}`, MARGIN, 15, bold, BLUE);
  y -= 16;
  write(`Laget ${formatDateTime(options.createdAt)}. Beløp i NOK.`, MARGIN, 9, font, MUTED);
  y -= 14;
  if (options.stripeUnavailable) {
    write("OBS: Stripe kunne ikke nås da rapporten ble laget – utbetalinger og gebyrer mangler. Last ned rapporten på nytt senere.", MARGIN, 9, bold, RED);
    y -= 14;
  }
  y -= 8;

  const { totals } = report;
  const summaryColumns: Column[] = [
    { title: "", width: 260 },
    { title: "Inkl. mva", width: 90, align: "right" },
    { title: "Eks. mva", width: 90, align: "right" },
    { title: "Mva 25 %", width: 90, align: "right" },
  ];
  drawRow(summaryColumns, ["Bilag i perioden", "Inkl. mva", "Eks. mva", "Mva 25 %"], bold, MUTED);
  for (const [label, amounts] of [
    ["Salg (kvitteringer)", totals.sales],
    ["Tilbakebetalinger (kreditnotaer)", totals.refunds],
    ["Netto", totals.net],
  ] as const) {
    if (label === "Netto") rule();
    drawRow(summaryColumns, [label, formatNok(amounts.incVatNok), formatNok(amounts.exVatNok), formatNok(amounts.vatNok)], label === "Netto" ? bold : font);
  }
  y -= 8;
  for (const [label, amount] of [
    ["Utbetalt fra Stripe til bank i perioden", totals.payoutsNok],
    ["Stripe-gebyrer på periodens betalinger (se Stripes fakturaer)", totals.feesNok],
    ["Ikke utbetalt fra Stripe da rapporten ble laget", totals.notPaidOutNok],
  ] as const) {
    drawRow(summaryColumns, [label, formatNok(amount)]);
  }
  y -= 14;

  // Every document.
  const documentHeader = () => {
    write("Bilag", MARGIN, 11, bold, BLUE);
    y -= 15;
    drawRow(DOCUMENT_COLUMNS, DOCUMENT_COLUMNS.map((column) => column.title), bold, MUTED);
    rule();
  };
  ensure(60);
  documentHeader();
  if (report.rows.length === 0) drawRow(DOCUMENT_COLUMNS, ["Ingen bilag i perioden."], font, MUTED);
  for (const row of report.rows) {
    ensure(ROW, documentHeader);
    drawRow(DOCUMENT_COLUMNS, [
      row.type,
      row.number,
      row.date,
      row.orderNumber,
      row.customer,
      formatNok(row.exVatNok),
      formatNok(row.vatNok),
      formatNok(row.incVatNok),
      row.credits ?? "",
      row.payoutId ?? "Ikke utbetalt",
      row.payoutDate ?? "",
      row.feeNok === null ? "" : formatNok(row.feeNok),
    ]);
  }
  y -= 14;

  // Stripe's payouts to the bank.
  const payoutColumns: Column[] = [
    { title: "Stripe-utbetaling", width: 220 },
    { title: "Dato i bank", width: 90 },
    { title: "Beløp", width: 90, align: "right" },
    { title: "Status", width: 0 },
  ];
  const payoutHeader = () => {
    write("Utbetalinger fra Stripe til bank", MARGIN, 11, bold, BLUE);
    y -= 15;
    drawRow(payoutColumns, payoutColumns.map((column) => column.title), bold, MUTED);
    rule();
  };
  ensure(60);
  payoutHeader();
  if (report.payouts.length === 0) drawRow(payoutColumns, ["Ingen utbetalinger i perioden."], font, MUTED);
  for (const payout of report.payouts) {
    ensure(ROW, payoutHeader);
    drawRow(payoutColumns, [payout.id, payout.arrivalDate, formatNok(payout.amountNok), payout.status]);
  }

  return doc.save();
}
