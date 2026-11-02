import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { roundNok } from "@/lib/orders/orderTotals";
import type { InvoiceCalculatorLine, InvoiceKind } from "@/lib/orders/manualPayments";

// A homepage order's faktura file (manual payments, lib/orders/manualPayments.ts).
// Every faktura is two pages: the faktura itself — one line, "Betaling for
// ordre 1042", and the sum — then its calculator page (the whole calculator
// on the first faktura, only what changed on a follow-up). Each new faktura's
// file carries every earlier one too, oldest first; one already marked paid
// is stamped with a diagonal "BETALT" so only the new one reads as owed.
// buildInvoicePages is the pure layout (tested); renderInvoicePdf draws it.

export type InvoiceSeller = { name: string; orgNumber: string; address: string; bankAccount: string; email: string };
export type InvoiceCustomer = { name: string; address: string; orgNumber: string | null; email: string };

export type InvoiceDocumentEntry = {
  number: string;
  kind: InvoiceKind;
  issuedAt: Date;
  dueDate: Date;
  // Incl. VAT, positive; a kreditnota is printed negative.
  amountIncVatNok: number;
  // Marked paid before this file was made: stamped "BETALT".
  paid: boolean;
  calculatorLines: InvoiceCalculatorLine[];
};

export type InvoiceDocumentInput = {
  displayId: number;
  seller: InvoiceSeller;
  customer: InvoiceCustomer;
  // Every faktura/kreditnota so far, oldest first; the last is the new one.
  entries: InvoiceDocumentEntry[];
};

type PageBase = { number: string; watermark: boolean };
export type InvoiceFakturaPage = PageBase & {
  type: "faktura";
  title: "Faktura" | "Kreditnota";
  issuedAt: Date;
  dueDate: Date;
  lines: { text: string; amountIncVatNok: number }[];
  exVatNok: number;
  vatNok: number;
  totalIncVatNok: number;
};
export type InvoiceCalculatorPage = PageBase & { type: "calculator"; rows: InvoiceCalculatorLine[] };
export type InvoicePage = InvoiceFakturaPage | InvoiceCalculatorPage;

// The snapshot's internal group/label keys (paidOrderSnapshot.ts) in Norwegian.
const GROUP_NAMES: Record<string, string> = { extras: "Tillegg", adjustment: "Justering" };
const LABEL_NAMES: Record<string, string> = { discount: "Rabatt", surcharge: "Tillegg" };

export function buildInvoicePages(input: InvoiceDocumentInput): InvoicePage[] {
  const last = input.entries.length - 1;
  return input.entries.flatMap((entry, index): InvoicePage[] => {
    // The newest faktura is what's owed now — never stamped.
    const watermark = index !== last && entry.kind === "invoice" && entry.paid;
    const refund = entry.kind === "refund";
    const total = roundNok(refund ? -entry.amountIncVatNok : entry.amountIncVatNok);
    const exVat = roundNok(total / 1.25);
    const faktura: InvoiceFakturaPage = {
      type: "faktura",
      number: entry.number,
      watermark,
      title: refund ? "Kreditnota" : "Faktura",
      issuedAt: entry.issuedAt,
      dueDate: entry.dueDate,
      lines: [{ text: `${refund ? "Tilbakebetaling" : "Betaling"} for ordre ${input.displayId}`, amountIncVatNok: total }],
      exVatNok: exVat,
      vatNok: roundNok(total - exVat),
      totalIncVatNok: total,
    };
    if (refund) return [faktura];
    const rows = entry.calculatorLines.map((line) => ({
      ...line,
      group: GROUP_NAMES[line.group] ?? line.group,
      label: LABEL_NAMES[line.label] ?? line.label,
    }));
    return [faktura, { type: "calculator", number: entry.number, watermark, rows }];
  });
}

// --- Rendering ---

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const BLUE = rgb(0.153, 0.188, 0.592); // #273097, the site's logo blue
const TEXT = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);

const formatKr = (amount: number) =>
  `${amount.toLocaleString("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ | /g, " ")} kr`;
const formatDate = (date: Date) => date.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });

// The standard fonts are WinAnsi: keep Latin-1 (æøå) and the usual
// typographic marks, swap anything else rather than fail the whole faktura.
function safe(text: string): string {
  return text.replace(/[^\x20-\x7e\xa0-\xff–—‘’“”…€•]/g, "?");
}

function formatOrgNumber(orgNumber: string) {
  const digits = orgNumber.replace(/\s/g, "");
  return /^\d{9}$/.test(digits) ? digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : orgNumber;
}

export async function renderInvoicePdf(input: InvoiceDocumentInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const text = (page: PDFPage, value: string, x: number, y: number, size = 10, useFont: PDFFont = font, color = TEXT) =>
    page.drawText(safe(value), { x, y, size, font: useFont, color });
  const right = (page: PDFPage, value: string, xRight: number, y: number, size = 10, useFont: PDFFont = font, color = TEXT) =>
    text(page, value, xRight - useFont.widthOfTextAtSize(safe(value), size), y, size, useFont, color);

  function stamp(page: PDFPage) {
    const size = 120;
    const width = bold.widthOfTextAtSize("BETALT", size);
    // Centred, rotated 35°: start left of centre, below it, by half the text's run.
    const angle = (35 * Math.PI) / 180;
    page.drawText("BETALT", {
      x: PAGE_WIDTH / 2 - (Math.cos(angle) * width) / 2,
      y: PAGE_HEIGHT / 2 - (Math.sin(angle) * width) / 2,
      size,
      font: bold,
      color: rgb(0.8, 0.1, 0.1),
      opacity: 0.18,
      rotate: degrees(35),
    });
  }

  function header(page: PDFPage, title: string, number: string) {
    text(page, input.seller.name, MARGIN, PAGE_HEIGHT - MARGIN, 16, bold, BLUE);
    let y = PAGE_HEIGHT - MARGIN - 16;
    for (const line of [input.seller.address, `Org.nr. ${formatOrgNumber(input.seller.orgNumber)} MVA`, input.seller.email]) {
      if (!line.trim()) continue;
      text(page, line, MARGIN, y, 9, font, MUTED);
      y -= 12;
    }
    right(page, title, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN, 22, bold, BLUE);
    right(page, `Nr. ${number}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 20, 11, bold);
  }

  function drawFaktura(p: InvoiceFakturaPage) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    header(page, p.title, p.number);

    // Customer (left) and the faktura's dates/payment details (right).
    let y = PAGE_HEIGHT - MARGIN - 90;
    text(page, p.title === "Kreditnota" ? "Til" : "Faktureres til", MARGIN, y, 9, bold, MUTED);
    y -= 14;
    for (const line of [
      input.customer.name,
      input.customer.address,
      input.customer.orgNumber ? `Org.nr. ${formatOrgNumber(input.customer.orgNumber)}` : "",
      input.customer.email,
    ]) {
      if (!line.trim()) continue;
      text(page, line, MARGIN, y, 10);
      y -= 13;
    }

    const details: [string, string][] = [
      [p.title === "Kreditnota" ? "Kreditnotadato" : "Fakturadato", formatDate(p.issuedAt)],
      ...(p.title === "Faktura" ? ([["Forfallsdato", formatDate(p.dueDate)]] as [string, string][]) : []),
      ["Ordre", String(input.displayId)],
      ...(p.title === "Faktura" ? ([["Kontonummer", input.seller.bankAccount], ["Merk betalingen", p.number]] as [string, string][]) : []),
    ];
    let dy = PAGE_HEIGHT - MARGIN - 90;
    for (const [label, value] of details) {
      text(page, label, PAGE_WIDTH - MARGIN - 200, dy, 9, font, MUTED);
      right(page, value, PAGE_WIDTH - MARGIN, dy, 10, bold);
      dy -= 14;
    }

    // The single line.
    y = Math.min(y, dy) - 40;
    text(page, "Beskrivelse", MARGIN, y, 9, bold, MUTED);
    right(page, "Beløp inkl. mva", PAGE_WIDTH - MARGIN, y, 9, bold, MUTED);
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: MUTED });
    y -= 18;
    for (const line of p.lines) {
      text(page, line.text, MARGIN, y, 11);
      right(page, formatKr(line.amountIncVatNok), PAGE_WIDTH - MARGIN, y, 11);
      y -= 18;
    }
    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 6 }, thickness: 0.5, color: MUTED });

    // Totals.
    y -= 14;
    for (const [label, value] of [
      ["Sum eks. mva", formatKr(p.exVatNok)],
      ["Mva 25 %", formatKr(p.vatNok)],
    ]) {
      text(page, label, PAGE_WIDTH - MARGIN - 200, y, 10, font, MUTED);
      right(page, value, PAGE_WIDTH - MARGIN, y, 10);
      y -= 16;
    }
    y -= 6;
    page.drawRectangle({ x: PAGE_WIDTH - MARGIN - 210, y: y - 10, width: 210, height: 30, color: rgb(0.92, 0.93, 0.98) });
    text(page, p.title === "Kreditnota" ? "Til gode" : "Å betale", PAGE_WIDTH - MARGIN - 200, y, 12, bold, BLUE);
    right(page, formatKr(Math.abs(p.totalIncVatNok)), PAGE_WIDTH - MARGIN - 10, y, 14, bold, BLUE);

    if (p.title === "Faktura") {
      text(page, "Spesifikasjon av ordren følger på neste side.", MARGIN, MARGIN + 10, 9, font, MUTED);
    }
    if (p.watermark) stamp(page);
  }

  function drawCalculator(p: InvoiceCalculatorPage) {
    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const start = () => {
      header(page, "Vedlegg", p.number);
      return PAGE_HEIGHT - MARGIN - 90;
    };
    let y = start();
    text(page, `Spesifikasjon – faktura ${p.number}`, MARGIN, y, 12, bold, BLUE);
    y -= 22;
    const columns = () => {
      text(page, "Linje", MARGIN, y, 9, bold, MUTED);
      right(page, "Antall", PAGE_WIDTH - MARGIN - 110, y, 9, bold, MUTED);
      right(page, "Beløp inkl. mva", PAGE_WIDTH - MARGIN, y, 9, bold, MUTED);
      y -= 6;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: MUTED });
      y -= 16;
    };
    columns();

    if (p.rows.length === 0) text(page, "Ingen linjer.", MARGIN, y, 10, font, MUTED);
    let group: string | null = null;
    for (const row of p.rows) {
      if (y < MARGIN + 40) {
        if (p.watermark) stamp(page);
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = start();
        columns();
        group = null;
      }
      if (row.group !== group) {
        group = row.group;
        text(page, group, MARGIN, y, 10, bold);
        y -= 15;
      }
      text(page, row.label.length > 70 ? `${row.label.slice(0, 69)}…` : row.label, MARGIN + 12, y, 10);
      right(page, row.qty === 1 ? "" : `x${row.qty}`, PAGE_WIDTH - MARGIN - 110, y, 10, font, MUTED);
      right(page, formatKr(row.price), PAGE_WIDTH - MARGIN, y, 10);
      y -= 15;
    }
    if (p.rows.length > 0) {
      const sum = roundNok(p.rows.reduce((total, row) => total + row.price, 0));
      y -= 4;
      page.drawLine({ start: { x: MARGIN, y: y + 10 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 10 }, thickness: 0.5, color: MUTED });
      text(page, "Sum", MARGIN, y - 4, 10, bold);
      right(page, formatKr(sum), PAGE_WIDTH - MARGIN, y - 4, 10, bold);
    }
    if (p.watermark) stamp(page);
  }

  for (const page of buildInvoicePages(input)) {
    if (page.type === "faktura") drawFaktura(page);
    else drawCalculator(page);
  }
  return doc.save();
}
