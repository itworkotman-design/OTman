import { describe, expect, it } from "vitest";
import { paymentCardState } from "./paymentCard";

const invoice = (over: Partial<{ kind: "invoice" | "refund"; amountIncVatNok: number; paidAt: string | null }> = {}) => ({
  kind: "invoice" as const,
  amountIncVatNok: 1250,
  paidAt: null as string | null,
  ...over,
});
const ledger = (invoicedIncVatNok: number, paidIncVatNok: number, currentIncVatNok: number) => ({
  invoicedIncVatNok,
  paidIncVatNok,
  currentIncVatNok,
  differenceIncVatNok: currentIncVatNok - invoicedIncVatNok,
});

describe("paymentCardState — the Payment card, live with the calculator", () => {
  it("offers the first faktura for the whole order when none was sent", () => {
    expect(paymentCardState({ invoices: [], ledger: ledger(0, 0, 1250) }, null)).toMatchObject({
      headline: "not_invoiced",
      totalIncVatNok: 1250,
      actions: { sendInvoiceCents: 125000, recordRefundCents: null, markPaid: false },
    });
  });

  it("has nothing to send before the order is priced", () => {
    expect(paymentCardState({ invoices: [], ledger: ledger(0, 0, 0) }, null)).toMatchObject({
      headline: "not_priced",
      actions: { sendInvoiceCents: null, recordRefundCents: null, markPaid: false },
    });
  });

  it("waits for payment after the faktura went out — only Mark paid", () => {
    expect(paymentCardState({ invoices: [invoice()], ledger: ledger(1250, 0, 1250) }, null)).toMatchObject({
      headline: "pending",
      allPaid: false,
      actions: { sendInvoiceCents: null, recordRefundCents: null, markPaid: true },
    });
  });

  it("is settled once paid and unchanged", () => {
    expect(paymentCardState({ invoices: [invoice({ paidAt: "2026-11-01" })], ledger: ledger(1250, 1250, 1250) }, null)).toMatchObject({
      headline: "paid",
      allPaid: true,
      actions: { sendInvoiceCents: null, recordRefundCents: null, markPaid: false },
    });
  });

  it("offers a faktura for what was added since — the customer paid, the order is now more", () => {
    expect(paymentCardState({ invoices: [invoice({ paidAt: "2026-11-01" })], ledger: ledger(1250, 1250, 1860) }, null)).toMatchObject({
      headline: "due_more",
      allPaid: true,
      differenceIncVatNok: 610,
      actions: { sendInvoiceCents: 61000, recordRefundCents: null, markPaid: false },
    });
  });

  it("offers a kreditnota for what the customer is owed when the order got cheaper", () => {
    expect(paymentCardState({ invoices: [invoice({ paidAt: "2026-11-01" })], ledger: ledger(1250, 1250, 950) }, null)).toMatchObject({
      headline: "owe_refund",
      differenceIncVatNok: -300,
      actions: { sendInvoiceCents: null, recordRefundCents: 30000, markPaid: false },
    });
  });

  it("still offers Mark paid next to the difference while the sent faktura is unpaid", () => {
    expect(paymentCardState({ invoices: [invoice()], ledger: ledger(1250, 0, 1500) }, null).actions).toEqual({
      sendInvoiceCents: 25000,
      recordRefundCents: null,
      markPaid: true,
    });
  });

  it("follows the calculator's unsaved total, but nothing can be sent until it's saved", () => {
    const state = paymentCardState({ invoices: [invoice({ paidAt: "2026-11-01" })], ledger: ledger(1250, 1250, 1250) }, 1500);
    expect(state).toMatchObject({
      afterChange: true,
      headline: "due_more",
      totalIncVatNok: 1500,
      differenceIncVatNok: 250,
      actions: { sendInvoiceCents: null, recordRefundCents: null, markPaid: false },
    });
  });
});
