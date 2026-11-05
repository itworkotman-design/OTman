import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderReceiptPdf } from "./receiptPdf";
import type { Receipt } from "./receiptDocument";

const receipt = (lines: number): Receipt => ({
  kind: "receipt",
  creditsReceiptNumber: null,
  number: "W-7",
  paidAt: new Date("2026-11-04T09:30:00Z"),
  orderNumber: "20046",
  deliveryDate: "2026-11-10",
  seller: { name: "Otman Transport AS", orgNumber: "923609016", address: "Storgata 1, 0155 Oslo", email: "info@otman.no" },
  customer: { name: "Kari Nordmann", address: "Karl Johans gate 10, Oslo", orgNumber: null, email: "kari@example.com" },
  lines: Array.from({ length: lines }, (_, i) => ({ group: i % 5 === 0 ? `Vare ${i}` : "Tillegg", label: `Linje ${i} – æøå`, qty: 1, price: 100 })),
  totalIncVatNok: lines * 100,
  exVatNok: lines * 80,
  vatNok: lines * 20,
});

describe("renderReceiptPdf", () => {
  it("draws the receipt on one page", async () => {
    const bytes = await renderReceiptPdf(receipt(3));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("continues on a new page when the lines don't fit", async () => {
    expect((await PDFDocument.load(await renderReceiptPdf(receipt(60)))).getPageCount()).toBeGreaterThan(1);
  });

  it("draws a credit note (kreditnota) with negative amounts", async () => {
    const note: Receipt = {
      ...receipt(2),
      kind: "creditNote",
      number: "W-12",
      creditsReceiptNumber: "W-7",
      lines: [{ group: "", label: "Tilbakebetaling for ordre 20046", qty: 1, price: -200 }],
      totalIncVatNok: -200,
      exVatNok: -160,
      vatNok: -40,
    };
    const bytes = await renderReceiptPdf(note);
    expect((await PDFDocument.load(bytes)).getTitle()).toBe("Kreditnota W-12");
    expect((await PDFDocument.load(await renderReceiptPdf(receipt(1)))).getTitle()).toBe("Kvittering W-7");
  });
});
