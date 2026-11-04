import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatOrderDate } from "@/lib/orders/formatOrderDate";
import type { Receipt } from "./receiptDocument";

// Draws a receipt (receiptDocument.ts) as an A4 PDF in the faktura's style
// (invoicePdf.ts): seller, "Kvittering" and its number, who paid, the dates,
// the lines covered, and the total with the VAT split out, marked paid by card.

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const BLUE = rgb(0.153, 0.188, 0.592); // #273097
const GREEN = rgb(0.08, 0.5, 0.24);
const TEXT = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);

const formatKr = (amount: number) =>
  `${amount.toLocaleString("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ | /g, " ")} kr`;
const formatDate = (date: Date) =>
  date.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Oslo" });

// The standard fonts are WinAnsi: keep Latin-1 (æøå) and the usual marks.
function safe(text: string): string {
  return text.replace(/[^\x20-\x7e\xa0-\xff–—‘’“”…€•]/g, "?");
}

function formatOrgNumber(orgNumber: string) {
  const digits = orgNumber.replace(/\s/g, "");
  return /^\d{9}$/.test(digits) ? digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : orgNumber;
}

export async function renderReceiptPdf(receipt: Receipt): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const text = (page: PDFPage, value: string, x: number, y: number, size = 10, useFont: PDFFont = font, color = TEXT) =>
    page.drawText(safe(value), { x, y, size, font: useFont, color });
  const right = (page: PDFPage, value: string, xRight: number, y: number, size = 10, useFont: PDFFont = font, color = TEXT) =>
    text(page, value, xRight - useFont.widthOfTextAtSize(safe(value), size), y, size, useFont, color);

  function newPage() {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    text(page, receipt.seller.name, MARGIN, PAGE_HEIGHT - MARGIN, 16, bold, BLUE);
    let y = PAGE_HEIGHT - MARGIN - 16;
    for (const line of [receipt.seller.address, `Org.nr. ${formatOrgNumber(receipt.seller.orgNumber)} MVA`, receipt.seller.email]) {
      if (!line.trim()) continue;
      text(page, line, MARGIN, y, 9, font, MUTED);
      y -= 12;
    }
    right(page, "Kvittering", PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN, 22, bold, BLUE);
    right(page, `Nr. ${receipt.number}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 20, 11, bold);
    return page;
  }

  let page = newPage();

  // Who paid (left) and the dates (right).
  let y = PAGE_HEIGHT - MARGIN - 90;
  text(page, "Kunde", MARGIN, y, 9, bold, MUTED);
  y -= 14;
  for (const line of [
    receipt.customer.name,
    receipt.customer.address,
    receipt.customer.orgNumber ? `Org.nr. ${formatOrgNumber(receipt.customer.orgNumber)}` : "",
    receipt.customer.email,
  ]) {
    if (!line.trim()) continue;
    text(page, line, MARGIN, y, 10);
    y -= 13;
  }
  const details: [string, string][] = [
    ["Betalt", formatDate(receipt.paidAt)],
    ["Ordre", receipt.orderNumber],
    ...(receipt.deliveryDate ? ([["Leveringsdato", formatOrderDate(receipt.deliveryDate, "no")]] as [string, string][]) : []),
    ["Betalingsmåte", "Kort"],
  ];
  let dy = PAGE_HEIGHT - MARGIN - 90;
  for (const [label, value] of details) {
    text(page, label, PAGE_WIDTH - MARGIN - 200, dy, 9, font, MUTED);
    right(page, value, PAGE_WIDTH - MARGIN, dy, 10, bold);
    dy -= 14;
  }

  // The lines.
  y = Math.min(y, dy) - 30;
  const columns = () => {
    text(page, "Beskrivelse", MARGIN, y, 9, bold, MUTED);
    right(page, "Antall", PAGE_WIDTH - MARGIN - 110, y, 9, bold, MUTED);
    right(page, "Beløp inkl. mva", PAGE_WIDTH - MARGIN, y, 9, bold, MUTED);
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: MUTED });
    y -= 16;
  };
  columns();
  let group: string | null = null;
  for (const row of receipt.lines) {
    if (y < MARGIN + 40) {
      page = newPage();
      y = PAGE_HEIGHT - MARGIN - 90;
      columns();
      group = null;
    }
    if (row.group && row.group !== group) {
      group = row.group;
      text(page, group, MARGIN, y, 10, bold);
      y -= 15;
    }
    const indent = row.group ? 12 : 0;
    text(page, row.label.length > 70 ? `${row.label.slice(0, 69)}…` : row.label, MARGIN + indent, y, 10);
    right(page, row.qty === 1 ? "" : `x${row.qty}`, PAGE_WIDTH - MARGIN - 110, y, 10, font, MUTED);
    right(page, formatKr(row.price), PAGE_WIDTH - MARGIN, y, 10);
    y -= 15;
  }

  // Totals (kept together, on a new page if needed).
  if (y < MARGIN + 110) {
    page = newPage();
    y = PAGE_HEIGHT - MARGIN - 90;
  }
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 6 }, thickness: 0.5, color: MUTED });
  y -= 14;
  for (const [label, value] of [
    ["Sum eks. mva", formatKr(receipt.exVatNok)],
    ["Mva 25 %", formatKr(receipt.vatNok)],
  ]) {
    text(page, label, PAGE_WIDTH - MARGIN - 200, y, 10, font, MUTED);
    right(page, value, PAGE_WIDTH - MARGIN, y, 10);
    y -= 16;
  }
  y -= 6;
  page.drawRectangle({ x: PAGE_WIDTH - MARGIN - 210, y: y - 10, width: 210, height: 30, color: rgb(0.91, 0.97, 0.93) });
  text(page, "Betalt", PAGE_WIDTH - MARGIN - 200, y, 12, bold, GREEN);
  right(page, formatKr(receipt.totalIncVatNok), PAGE_WIDTH - MARGIN - 10, y, 14, bold, GREEN);

  text(page, "Beløpet er betalt med kort. Ingenting å betale.", MARGIN, MARGIN + 10, 9, font, MUTED);
  return doc.save();
}
