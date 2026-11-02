import { describe, expect, it } from "vitest";
import type { OrderStateSnapshot } from "@/lib/orders/paidOrderSnapshot";
import type { InvoiceEntry } from "@/lib/orders/manualPayments";
import { buildInvoiceEmail, invoiceDocumentEntries, invoiceCustomer, invoiceSellerFromEnv } from "./invoiceDocument";

const snapshot = (total: number, lines: [string, string, number, number][]): OrderStateSnapshot => ({
  version: 1,
  totalIncVatNok: total,
  lines: lines.map(([group, label, qty, price]) => ({ key: `${group}::${label}`, group, label, qty, price })),
  details: [],
});
const first = snapshot(1000, [["Vaskemaskin", "Levering", 1, 1000]]);
const second = snapshot(1300, [
  ["Vaskemaskin", "Levering", 1, 1000],
  ["extras", "Bæring", 1, 300],
]);
const entry = (over: Partial<InvoiceEntry>): InvoiceEntry => ({
  sequence: 1,
  kind: "invoice",
  amountCents: 100000,
  totalAfterCents: 100000,
  orderSnapshot: first,
  paidAt: null,
  createdAt: new Date("2026-10-30T10:00:00Z"),
  ...over,
});

describe("invoiceDocumentEntries — every faktura so far, as the file shows them", () => {
  it("numbers them by the order ID, marks the paid ones and gives each only its own lines", () => {
    const entries = [
      entry({ paidAt: new Date("2026-10-31T10:00:00Z") }),
      entry({ sequence: 2, amountCents: 30000, totalAfterCents: 130000, orderSnapshot: second, createdAt: new Date("2026-11-02T10:00:00Z") }),
    ];
    const doc = invoiceDocumentEntries(1042, entries, { dueDays: 14 });
    expect(doc.map((d) => [d.number, d.paid, d.amountIncVatNok])).toEqual([
      ["1042", true, 1000],
      ["1042-2", false, 300],
    ]);
    expect(doc[0]!.calculatorLines).toEqual([{ group: "Vaskemaskin", label: "Levering", qty: 1, price: 1000 }]);
    expect(doc[1]!.calculatorLines).toEqual([{ group: "extras", label: "Bæring", qty: 1, price: 300 }]);
    expect(doc[1]!.dueDate.toISOString()).toBe("2026-11-16T10:00:00.000Z");
  });
});

describe("invoiceCustomer", () => {
  it("bills the customer at the order's address, with a business's org number", () => {
    expect(
      invoiceCustomer({
        customerName: "Bedrift AS",
        customerLabel: null,
        email: "post@bedrift.no",
        deliveryAddress: "Kirkegata 5",
        pickupAddress: "Strømmen 1",
        websiteBookingDetails: { customerType: "business", orgNumber: "974760673" },
      }),
    ).toEqual({ name: "Bedrift AS", address: "Kirkegata 5", orgNumber: "974760673", email: "post@bedrift.no" });
  });
});

describe("invoiceSellerFromEnv", () => {
  it("reads the seller's details, due days 14 by default", () => {
    const seller = invoiceSellerFromEnv({
      INVOICE_SELLER_NAME: "Otman AS",
      INVOICE_ORG_NUMBER: "974760673",
      INVOICE_ADDRESS: "Industriveien 1",
      INVOICE_BANK_ACCOUNT: "1234.56.78901",
      INVOICE_EMAIL: "post@otman.no",
    });
    expect(seller).toEqual({
      seller: { name: "Otman AS", orgNumber: "974760673", address: "Industriveien 1", bankAccount: "1234.56.78901", email: "post@otman.no" },
      dueDays: 14,
    });
  });

  it("is null without a bank account — a faktura can't be paid without one", () => {
    expect(invoiceSellerFromEnv({ INVOICE_SELLER_NAME: "Otman AS" })).toBeNull();
  });
});

describe("buildInvoiceEmail", () => {
  it("names the faktura, the amount and the due date", () => {
    const { subject, html } = buildInvoiceEmail({
      kind: "invoice",
      number: "1042-2",
      displayId: 1042,
      customerName: "Kari",
      amountIncVatNok: 300,
      dueDate: new Date("2026-11-16T10:00:00Z"),
      bankAccount: "1234.56.78901",
    });
    expect(subject).toBe("Faktura 1042-2 for ordre 1042");
    expect(html).toContain("Hei Kari");
    expect(html).toContain("300 kr");
    expect(html).toContain("16.11.2026");
    expect(html).toContain("1234.56.78901");
  });

  it("words a kreditnota as money back", () => {
    const { subject, html } = buildInvoiceEmail({
      kind: "refund",
      number: "1042-K3",
      displayId: 1042,
      customerName: "Kari",
      amountIncVatNok: 200,
      dueDate: new Date("2026-11-16T10:00:00Z"),
      bankAccount: "1234.56.78901",
    });
    expect(subject).toBe("Kreditnota 1042-K3 for ordre 1042");
    expect(html).toContain("200 kr");
    expect(html).not.toContain("1234.56.78901");
  });
});
