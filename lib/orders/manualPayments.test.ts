import { describe, expect, it } from "vitest";
import type { OrderStateSnapshot } from "./paidOrderSnapshot";
import {
  gsmReadiness,
  invoiceCalculatorLines,
  invoiceLedger,
  invoiceNumber,
  nextPaymentStatus,
  gsmNotReadyWarning,
  type InvoiceEntry,
} from "./manualPayments";

const snapshot = (total: number, lines: [string, string, number, number][]): OrderStateSnapshot => ({
  version: 1,
  totalIncVatNok: total,
  lines: lines.map(([group, label, qty, price]) => ({ key: `${group}::${label}`, group, label, qty, price })),
  details: [],
});

const first = snapshot(1000, [
  ["Vaskemaskin", "Levering", 1, 800],
  ["extras", "Etasjetillegg", 1, 200],
]);

const entry = (over: Partial<InvoiceEntry> = {}): InvoiceEntry => ({
  sequence: 1,
  kind: "invoice",
  amountCents: 100000,
  totalAfterCents: 100000,
  orderSnapshot: first,
  paidAt: null,
  createdAt: new Date("2026-10-30T10:00:00Z"),
  ...over,
});

describe("invoiceNumber — the faktura number is the order's ID", () => {
  it("is the order ID for the first faktura, then ID-2, ID-3…", () => {
    expect(invoiceNumber(1042, { sequence: 1, kind: "invoice" })).toBe("1042");
    expect(invoiceNumber(1042, { sequence: 2, kind: "invoice" })).toBe("1042-2");
    expect(invoiceNumber(1042, { sequence: 3, kind: "invoice" })).toBe("1042-3");
  });

  it("marks a kreditnota with K", () => {
    expect(invoiceNumber(1042, { sequence: 2, kind: "refund" })).toBe("1042-K2");
  });
});

describe("invoiceLedger", () => {
  it("is 'none' before any faktura was sent", () => {
    const ledger = invoiceLedger([], first);
    expect(ledger.outcome).toBe("none");
    expect(ledger.differenceIncVatNok).toBe(1000);
  });

  it("is pending while the sent faktura isn't marked paid", () => {
    const ledger = invoiceLedger([entry()], first);
    expect(ledger).toMatchObject({ outcome: "invoice_pending", invoicedIncVatNok: 1000, paidIncVatNok: 0, differenceIncVatNok: 0 });
  });

  it("is paid once every faktura is marked paid and the total hasn't moved", () => {
    const ledger = invoiceLedger([entry({ paidAt: new Date() })], first);
    expect(ledger).toMatchObject({ outcome: "paid", paidIncVatNok: 1000 });
  });

  it("shows what was added since the last faktura, and that more is due", () => {
    const now = snapshot(1300, [
      ["Vaskemaskin", "Levering", 1, 800],
      ["extras", "Etasjetillegg", 1, 200],
      ["extras", "Bæring", 1, 300],
    ]);
    const ledger = invoiceLedger([entry({ paidAt: new Date() })], now);
    expect(ledger).toMatchObject({ outcome: "due_more", differenceIncVatNok: 300, paidIncVatNok: 1000 });
    expect(ledger.lineChanges.map((c) => [c.kind, c.label, c.delta])).toEqual([["added", "Bæring", 300]]);
  });

  it("says the customer is owed money when the total went down", () => {
    const now = snapshot(800, [["Vaskemaskin", "Levering", 1, 800]]);
    expect(invoiceLedger([entry({ paidAt: new Date() })], now)).toMatchObject({ outcome: "owe_refund", differenceIncVatNok: -200 });
  });

  it("counts a recorded refund (kreditnota) against what was invoiced", () => {
    const now = snapshot(800, [["Vaskemaskin", "Levering", 1, 800]]);
    const refund = entry({ sequence: 2, kind: "refund", amountCents: 20000, totalAfterCents: 80000, orderSnapshot: now, paidAt: new Date() });
    const ledger = invoiceLedger([entry({ paidAt: new Date() }), refund], now);
    expect(ledger).toMatchObject({ outcome: "paid", invoicedIncVatNok: 800, differenceIncVatNok: 0 });
  });

  it("compares with the latest faktura's snapshot", () => {
    const second = snapshot(1300, [
      ["Vaskemaskin", "Levering", 1, 800],
      ["extras", "Etasjetillegg", 1, 200],
      ["extras", "Bæring", 1, 300],
    ]);
    const entries = [entry({ paidAt: new Date() }), entry({ sequence: 2, amountCents: 30000, totalAfterCents: 130000, orderSnapshot: second })];
    const ledger = invoiceLedger(entries, second);
    expect(ledger).toMatchObject({ outcome: "invoice_pending", invoicedIncVatNok: 1300, paidIncVatNok: 1000, differenceIncVatNok: 0 });
    expect(ledger.lineChanges).toEqual([]);
  });
});

describe("nextPaymentStatus — only the Mark paid button makes an order paid", () => {
  it("has no payment status before the first faktura", () => {
    expect(nextPaymentStatus([], 1000)).toBeNull();
  });

  it("goes pending when the price changes, even on a paid order", () => {
    expect(nextPaymentStatus([entry({ paidAt: new Date() })], 1300)).toBe("pending");
    expect(nextPaymentStatus([entry({ paidAt: new Date() })], 900)).toBe("pending");
  });

  it("stays paid when every faktura is paid and the total is unchanged", () => {
    expect(nextPaymentStatus([entry({ paidAt: new Date() })], 1000)).toBe("paid");
  });

  it("stays pending while a faktura is unpaid", () => {
    expect(nextPaymentStatus([entry()], 1000)).toBe("pending");
  });
});

describe("invoiceCalculatorLines — the faktura's calculator page", () => {
  it("lists every line on the first faktura", () => {
    expect(invoiceCalculatorLines(null, first)).toEqual([
      { group: "Vaskemaskin", label: "Levering", qty: 1, price: 800 },
      { group: "extras", label: "Etasjetillegg", qty: 1, price: 200 },
    ]);
  });

  it("lists only what changed since the previous faktura on a follow-up", () => {
    const now = snapshot(1250, [
      ["Vaskemaskin", "Levering", 1, 800],
      ["extras", "Etasjetillegg", 2, 150],
      ["extras", "Bæring", 1, 300],
    ]);
    expect(invoiceCalculatorLines(first, now)).toEqual([
      { group: "extras", label: "Etasjetillegg", qty: 2, price: -50 },
      { group: "extras", label: "Bæring", qty: 1, price: 300 },
    ]);
  });
});

describe("gsmReadiness — homepage orders go to GSM confirmed and paid, otherwise flagged", () => {
  it("is ready when confirmed and paid", () => {
    expect(gsmReadiness({ websiteOrderKind: "WHITE_GOODS", status: "confirmed", paymentStatus: "paid" })).toEqual([]);
  });

  it("flags a homepage order that isn't confirmed or isn't paid", () => {
    expect(gsmReadiness({ websiteOrderKind: "MOVING", status: "processing", paymentStatus: "pending" })).toEqual(["NOT_CONFIRMED", "NOT_PAID"]);
    expect(gsmReadiness({ websiteOrderKind: "SERVICE", status: "Bekreftet", paymentStatus: null })).toEqual(["NOT_PAID"]);
  });

  it("never flags a regular order", () => {
    expect(gsmReadiness({ websiteOrderKind: null, status: "pending", paymentStatus: null })).toEqual([]);
  });
});

describe("gsmNotReadyWarning — asked before sending to GSM", () => {
  it("names each homepage order that isn't confirmed or paid", () => {
    expect(
      gsmNotReadyWarning([
        { displayId: 1042, websiteOrderKind: "WHITE_GOODS", status: "confirmed", paymentStatus: "pending" },
        { displayId: 1043, websiteOrderKind: "MOVING", status: "processing", paymentStatus: "paid" },
        { displayId: 1044, websiteOrderKind: "SERVICE", status: "active", paymentStatus: null },
        { displayId: 7, websiteOrderKind: null, status: "pending", paymentStatus: null },
        { displayId: 1045, websiteOrderKind: "WHITE_GOODS", status: "confirmed", paymentStatus: "paid" },
      ]),
    ).toBe("Order 1042 is not paid.\nOrder 1043 is not confirmed.\nOrder 1044 is not confirmed and not paid.\n\nSend to GSM anyway?");
  });

  it("is null when every order is ready", () => {
    expect(gsmNotReadyWarning([{ displayId: 1, websiteOrderKind: "WHITE_GOODS", status: "confirmed", paymentStatus: "paid" }])).toBeNull();
  });
});
