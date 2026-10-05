import { describe, expect, it } from "vitest";
import { planWebsiteOrderPaymentLink } from "./websiteOrderPaymentLink";

const base = { email: "kari@example.no", remainingBalanceIncVatNok: 0 };

describe("planWebsiteOrderPaymentLink", () => {
  it("approves a not-yet-approved order and sends the payment request", () => {
    for (const status of ["processing", "rejected", "", null]) {
      expect(planWebsiteOrderPaymentLink({ ...base, status })).toEqual({
        ok: true,
        kind: "payment_request",
        approve: true,
      });
    }
  });

  it("re-sends the payment request for an order already waiting on payment", () => {
    for (const status of ["approved", "failed", "Approved"]) {
      expect(planWebsiteOrderPaymentLink({ ...base, status })).toEqual({
        ok: true,
        kind: "payment_request",
        approve: false,
      });
    }
  });

  it("asks a paid (confirmed) order for the difference once it owes more", () => {
    expect(planWebsiteOrderPaymentLink({ ...base, status: "confirmed", remainingBalanceIncVatNok: 250 })).toEqual({
      ok: true,
      kind: "balance_due",
      approve: false,
    });
  });

  it("has nothing to send when a paid order owes nothing", () => {
    expect(planWebsiteOrderPaymentLink({ ...base, status: "confirmed", remainingBalanceIncVatNok: 0 })).toEqual({
      ok: false,
      reason: "NOTHING_TO_PAY",
    });
  });

  it("refuses orders past the payment stage", () => {
    for (const status of ["active", "cancelled", "completed", "invoiced", "paid"]) {
      expect(planWebsiteOrderPaymentLink({ ...base, status })).toEqual({ ok: false, reason: "NOT_PAYABLE_STATUS" });
    }
  });

  it("needs a customer email to send anything", () => {
    expect(planWebsiteOrderPaymentLink({ ...base, status: "processing", email: "  " })).toEqual({
      ok: false,
      reason: "MISSING_CUSTOMER_EMAIL",
    });
    expect(planWebsiteOrderPaymentLink({ ...base, status: "processing", email: null })).toEqual({
      ok: false,
      reason: "MISSING_CUSTOMER_EMAIL",
    });
  });
});
