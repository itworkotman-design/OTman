import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildInvoicePages, renderInvoicePdf, type InvoiceDocumentInput } from "./invoicePdf";

const seller = { name: "OTman Transport AS", orgNumber: "974760673", address: "Industriveien 1, 2020 Skedsmokorset", bankAccount: "1234.56.78901", email: "post@otman.no" };
const customer = { name: "Kari Nordmann", address: "Kirkegata 5, 0153 Oslo", orgNumber: null, email: "kari@example.no" };

const firstLines = [
  { group: "Vaskemaskin", label: "Levering", qty: 1, price: 800 },
  { group: "extras", label: "Etasjetillegg", qty: 1, price: 200 },
];

const input = (over: Partial<InvoiceDocumentInput> = {}): InvoiceDocumentInput => ({
  displayId: 1042,
  seller,
  customer,
  entries: [
    {
      number: "1042",
      kind: "invoice",
      issuedAt: new Date("2026-10-30T10:00:00Z"),
      dueDate: new Date("2026-11-13T10:00:00Z"),
      amountIncVatNok: 1000,
      paid: false,
      calculatorLines: firstLines,
    },
  ],
  ...over,
});

const followUp = {
  number: "1042-2",
  kind: "invoice" as const,
  issuedAt: new Date("2026-11-02T10:00:00Z"),
  dueDate: new Date("2026-11-16T10:00:00Z"),
  amountIncVatNok: 300,
  paid: false,
  calculatorLines: [{ group: "extras", label: "Bæring", qty: 1, price: 300 }],
};

describe("buildInvoicePages", () => {
  it("is a faktura page with one line — payment for the order — and its calculator page", () => {
    const pages = buildInvoicePages(input());
    expect(pages.map((p) => p.type)).toEqual(["faktura", "calculator"]);
    const faktura = pages[0]!;
    expect(faktura.type === "faktura" && faktura).toMatchObject({
      number: "1042",
      title: "Faktura",
      lines: [{ text: "Betaling for ordre 1042", amountIncVatNok: 1000 }],
      exVatNok: 800,
      vatNok: 200,
      totalIncVatNok: 1000,
      watermark: false,
    });
  });

  it("lists every line of the first faktura on its calculator page, extras named in Norwegian", () => {
    const calculator = buildInvoicePages(input())[1]!;
    expect(calculator.type === "calculator" && calculator.rows).toEqual([
      { group: "Vaskemaskin", label: "Levering", qty: 1, price: 800 },
      { group: "Tillegg", label: "Etasjetillegg", qty: 1, price: 200 },
    ]);
  });

  it("puts every faktura so far in one file, oldest first; a paid one is watermarked BETALT, the new one isn't", () => {
    const pages = buildInvoicePages(
      input({ entries: [{ ...input().entries[0]!, paid: true }, followUp] }),
    );
    expect(pages.map((p) => [p.type, p.number, p.watermark])).toEqual([
      ["faktura", "1042", true],
      ["calculator", "1042", true],
      ["faktura", "1042-2", false],
      ["calculator", "1042-2", false],
    ]);
    const second = pages[3]!;
    expect(second.type === "calculator" && second.rows).toEqual([{ group: "Tillegg", label: "Bæring", qty: 1, price: 300 }]);
  });

  it("leaves an earlier unpaid faktura unmarked — it's still owed", () => {
    const pages = buildInvoicePages(input({ entries: [input().entries[0]!, followUp] }));
    expect(pages.filter((p) => p.watermark)).toEqual([]);
  });

  it("renders a kreditnota as money back to the customer", () => {
    const pages = buildInvoicePages(
      input({
        entries: [
          { ...input().entries[0]!, paid: true },
          { ...followUp, number: "1042-K2", kind: "refund", amountIncVatNok: 200, calculatorLines: [] },
        ],
      }),
    );
    const credit = pages.find((p) => p.number === "1042-K2" && p.type === "faktura")!;
    expect(credit).toMatchObject({ title: "Kreditnota", lines: [{ text: "Tilbakebetaling for ordre 1042", amountIncVatNok: -200 }], totalIncVatNok: -200 });
  });
});

describe("renderInvoicePdf", () => {
  it("renders every page to a PDF", async () => {
    const bytes = await renderInvoicePdf(input({ entries: [{ ...input().entries[0]!, paid: true }, followUp] }));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(4);
  });
});
