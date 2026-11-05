import { describe, expect, it } from "vitest";
import type { OrderStateSnapshot } from "@/lib/orders/paidOrderSnapshot";
import {
  buildCreditNote,
  buildCreditNoteEmail,
  buildReceipt,
  buildReceiptEmail,
  receiptFilename,
  receiptPreviousSnapshot,
  receiptSellerFromEnv,
} from "./receiptDocument";

const snapshot = (total: number, lines: [string, string, number, number][]): OrderStateSnapshot => ({
  version: 1,
  totalIncVatNok: total,
  lines: lines.map(([group, label, qty, price]) => ({ key: `${group}::${label}`, group, label, qty, price })),
  details: [],
});
const booked = snapshot(1250, [
  ["Vaskemaskin", "Levering med innbæring", 1, 1000],
  ["extras", "Kjøring", 1, 250],
]);
const added = snapshot(1750, [
  ["Vaskemaskin", "Levering med innbæring", 1, 1000],
  ["Vaskemaskin", "Montering", 1, 500],
  ["extras", "Kjøring", 1, 250],
]);
const seller = { name: "Otman Transport AS", orgNumber: "923609016", address: "Storgata 1, 0155 Oslo", email: "info@otman.no" };
const customer = { name: "Kari Nordmann", address: "Karl Johans gate 10, Oslo", orgNumber: null, email: "kari@example.com" };
const at = (iso: string) => new Date(iso);

describe("receiptSellerFromEnv — who sold it (bokføringsforskriften: name and org.nr.)", () => {
  it("needs the seller's name and org number; no bank account (it's already paid)", () => {
    expect(
      receiptSellerFromEnv({ INVOICE_SELLER_NAME: " Otman Transport AS ", INVOICE_ORG_NUMBER: "923609016", INVOICE_ADDRESS: "Storgata 1", INVOICE_EMAIL: "info@otman.no" }),
    ).toEqual({ name: "Otman Transport AS", orgNumber: "923609016", address: "Storgata 1", email: "info@otman.no" });
    expect(receiptSellerFromEnv({ INVOICE_SELLER_NAME: "Otman" })).toBeNull();
    expect(receiptSellerFromEnv({ INVOICE_ORG_NUMBER: "923609016" })).toBeNull();
  });
});

describe("receiptPreviousSnapshot — what a payment is compared against", () => {
  it("is nothing for the first payment, else the latest payment or refund before it", () => {
    const payments = [
      { id: "p1", createdAt: at("2026-11-01T10:00:00Z"), orderSnapshot: booked },
      { id: "p2", createdAt: at("2026-11-03T10:00:00Z"), orderSnapshot: added },
    ];
    const refunds = [{ createdAt: at("2026-11-02T10:00:00Z"), orderSnapshot: snapshot(1000, [["Vaskemaskin", "Levering med innbæring", 1, 1000]]) }];

    expect(receiptPreviousSnapshot(payments[0]!, payments, refunds)).toBeNull();
    expect(receiptPreviousSnapshot(payments[1]!, payments, refunds)?.totalIncVatNok).toBe(1000);
    expect(receiptPreviousSnapshot(payments[1]!, payments, [])?.totalIncVatNok).toBe(1250);
  });
});

describe("buildReceipt — the receipt's content", () => {
  it("lists every line for the first payment, with the VAT split out of what was charged", () => {
    const receipt = buildReceipt({
      number: 7,
      paidAt: at("2026-11-04T09:30:00Z"),
      orderNumber: "20046",
      deliveryDate: "2026-11-10",
      seller,
      customer,
      amountChargedCents: 125000,
      previous: null,
      snapshot: booked,
    });

    expect(receipt.number).toBe("W-7");
    expect(receipt.kind).toBe("receipt");
    expect(receipt.lines).toEqual([
      { group: "Vaskemaskin", label: "Levering med innbæring", qty: 1, price: 1000 },
      { group: "Tillegg", label: "Kjøring", qty: 1, price: 250 },
    ]);
    expect(receipt).toMatchObject({ totalIncVatNok: 1250, exVatNok: 1000, vatNok: 250, orderNumber: "20046", deliveryDate: "2026-11-10" });
  });

  it("names the lines in Norwegian, as the customer saw them (the order stores the English catalog names)", () => {
    const english = snapshot(870, [["Washing machine", "Delivery with carry-in", 1, 870]]);
    const receipt = buildReceipt({ number: 1, paidAt: at("2026-11-04T09:30:00Z"), orderNumber: "20046", deliveryDate: null, seller, customer, amountChargedCents: 87000, previous: null, snapshot: english });
    expect(receipt.lines).toEqual([{ group: "Vaskemaskin", label: "Levering med innbæring", qty: 1, price: 870 }]);
  });

  it("lists only what was added for a later payment (the difference paid)", () => {
    const receipt = buildReceipt({
      number: 8,
      paidAt: at("2026-11-05T09:30:00Z"),
      orderNumber: "20046",
      deliveryDate: null,
      seller,
      customer,
      amountChargedCents: 50000,
      previous: booked,
      snapshot: added,
    });

    expect(receipt.lines).toEqual([{ group: "Vaskemaskin", label: "Montering", qty: 1, price: 500 }]);
    expect(receipt).toMatchObject({ totalIncVatNok: 500, exVatNok: 400, vatNok: 100 });
  });

  it("falls back to one line when the payment has no stored snapshot", () => {
    const receipt = buildReceipt({ number: 9, paidAt: at("2026-11-05T09:30:00Z"), orderNumber: "20046", deliveryDate: null, seller, customer, amountChargedCents: 31000, previous: null, snapshot: null });
    expect(receipt.lines).toEqual([{ group: "", label: "Betaling for ordre 20046", qty: 1, price: 310 }]);
  });
});

describe("receipt email", () => {
  it("names the file and tells the customer what was paid", () => {
    expect(receiptFilename("W-7")).toBe("Kvittering W-7.pdf");
    const { subject, html } = buildReceiptEmail({ number: "W-7", orderNumber: "20046", customerName: "Kari", amountIncVatNok: 1250 });
    expect(subject).toBe("Kvittering W-7 for ordre 20046");
    expect(html).toContain("Hei Kari");
    expect(html).toMatch(/1\s250 kr/);
    expect(html).toContain("vedlagt");
  });
});

describe("buildCreditNote — the kreditnota for a Stripe refund", () => {
  const base = {
    number: 12,
    refundedAt: at("2026-11-06T09:30:00Z"),
    orderNumber: "20046",
    deliveryDate: null,
    seller,
    customer,
    creditsReceiptNumber: "W-7",
  };

  it("is numbered in the same series, refers to the receipt it credits, and carries negative amounts", () => {
    const note = buildCreditNote({ ...base, amountRefundedCents: 125000, previous: null, snapshot: null });

    expect(note).toMatchObject({ kind: "creditNote", number: "W-12", creditsReceiptNumber: "W-7" });
    expect(note).toMatchObject({ totalIncVatNok: -1250, exVatNok: -1000, vatNok: -250 });
    expect(note.lines).toEqual([{ group: "", label: "Tilbakebetaling for ordre 20046", qty: 1, price: -1250 }]);
  });

  it("lists what was removed when the refund settles a price change", () => {
    const note = buildCreditNote({ ...base, amountRefundedCents: 50000, previous: added, snapshot: booked });
    expect(note.lines).toEqual([{ group: "Vaskemaskin", label: "Montering", qty: 1, price: -500 }]);
    expect(note).toMatchObject({ totalIncVatNok: -500, exVatNok: -400, vatNok: -100 });
  });

  it("falls back to one line when the changed lines don't add up to what was refunded (a refund split across payments)", () => {
    const note = buildCreditNote({ ...base, amountRefundedCents: 20000, previous: added, snapshot: booked });
    expect(note.lines).toEqual([{ group: "", label: "Tilbakebetaling for ordre 20046", qty: 1, price: -200 }]);
  });

  it("names the file and tells the customer what was paid back", () => {
    expect(receiptFilename("W-12", "creditNote")).toBe("Kreditnota W-12.pdf");
    const { subject, html } = buildCreditNoteEmail({ number: "W-12", orderNumber: "20046", customerName: "Kari", amountIncVatNok: 500 });
    expect(subject).toBe("Kreditnota W-12 for ordre 20046");
    expect(html).toContain("Hei Kari");
    expect(html).toMatch(/500 kr/);
    expect(html).toContain("kortet");
  });
});
