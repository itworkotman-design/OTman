import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { GDPR_EVENT_LABELS, formatGdprEventDetail } from "@/lib/gdpr/auditEvents";

export type AuditLogPdfEvent = {
  orderDisplayId: number;
  type: string;
  payload: unknown;
  actor: string;
  createdAt: Date;
};

const PAGE_WIDTH = 841.89; // A4 landscape, points
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;
const LINE_HEIGHT = 16;
const COLUMN_X = {
  order: MARGIN,
  event: MARGIN + 60,
  detail: MARGIN + 170,
  actor: MARGIN + 520,
  when: MARGIN + 660,
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("nb-NO");
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("nb-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export async function buildGdprAuditLogPdf(input: {
  companyName: string;
  from: Date | null;
  to: Date | null;
  events: AuditLogPdfEvent[];
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function drawText(text: string, x: number, size: number, useFont: PDFFont, target: PDFPage = page) {
    target.drawText(text, { x, y, size, font: useFont, color: rgb(0.1, 0.1, 0.1) });
  }

  function newPageIfNeeded() {
    if (y < MARGIN + LINE_HEIGHT) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawColumnHeaders();
    }
  }

  function drawColumnHeaders() {
    drawText("Order", COLUMN_X.order, 9, boldFont);
    drawText("Event", COLUMN_X.event, 9, boldFont);
    drawText("Detail", COLUMN_X.detail, 9, boldFont);
    drawText("Actor", COLUMN_X.actor, 9, boldFont);
    drawText("When", COLUMN_X.when, 9, boldFont);
    y -= LINE_HEIGHT;
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
  }

  drawText(`GDPR audit log — ${input.companyName}`, MARGIN, 16, boldFont);
  y -= LINE_HEIGHT * 1.5;

  const rangeLabel = `Period: ${input.from ? formatDate(input.from) : "Earliest"} – ${input.to ? formatDate(input.to) : "Latest"}   |   ${input.events.length} event(s)`;
  drawText(rangeLabel, MARGIN, 10, font);
  y -= LINE_HEIGHT * 1.5;

  drawColumnHeaders();

  if (input.events.length === 0) {
    drawText("No GDPR events recorded in this period.", MARGIN, 10, font);
    y -= LINE_HEIGHT;
  }

  for (const event of input.events) {
    newPageIfNeeded();

    drawText(`#${event.orderDisplayId}`, COLUMN_X.order, 9, font);
    drawText(GDPR_EVENT_LABELS[event.type] ?? event.type, COLUMN_X.event, 9, font);
    drawText(truncate(formatGdprEventDetail(event.type, event.payload), 60), COLUMN_X.detail, 9, font);
    drawText(truncate(event.actor, 24), COLUMN_X.actor, 9, font);
    drawText(formatDateTime(event.createdAt), COLUMN_X.when, 9, font);
    y -= LINE_HEIGHT;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
