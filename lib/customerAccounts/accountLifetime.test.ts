import { describe, expect, it } from "vitest";
import { customerAccountDeleteAt, isCustomerAccountExpired, isOrderClosedForCustomer } from "./accountLifetime";

type TestOrder = Parameters<typeof customerAccountDeleteAt>[0][number];

function order(overrides: Partial<TestOrder> = {}): TestOrder {
  return {
    status: "completed",
    statusChangedAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-10-01T10:00:00Z"),
    gdprHold: false,
    ...overrides,
  };
}

describe("isOrderClosedForCustomer", () => {
  it.each(["completed", "cancelled", "failed", "invoiced", "paid", "Ferdig", "kanselert", "feilet"])("%s is closed", (status) => {
    expect(isOrderClosedForCustomer(status)).toBe(true);
  });

  it.each(["processing", "approved", "rejected", "confirmed", "active", "", null])("%s is open", (status) => {
    expect(isOrderClosedForCustomer(status)).toBe(false);
  });
});

describe("customerAccountDeleteAt", () => {
  it("is one day after the last status change once every order is closed", () => {
    expect(customerAccountDeleteAt([order()])).toEqual(new Date("2026-10-02T10:00:00Z"));
  });

  it("keeps the account while any order is still open", () => {
    expect(customerAccountDeleteAt([order(), order({ status: "processing" })])).toBeNull();
  });

  it("counts a failed order as closed, so a no-show starts the countdown", () => {
    expect(customerAccountDeleteAt([order({ status: "failed" })])).toEqual(new Date("2026-10-02T10:00:00Z"));
  });

  it("keeps the account again once a failed order is put back to processing", () => {
    expect(customerAccountDeleteAt([order({ status: "processing" })])).toBeNull();
  });

  it("keeps the account indefinitely while any order is on hold (insurance case)", () => {
    expect(customerAccountDeleteAt([order({ gdprHold: true })])).toBeNull();
    expect(customerAccountDeleteAt([order(), order({ status: "cancelled", gdprHold: true })])).toBeNull();
  });

  it("counts from the latest change across all the account's orders", () => {
    const deleteAt = customerAccountDeleteAt([
      order({ statusChangedAt: new Date("2026-10-01T10:00:00Z"), updatedAt: new Date("2026-10-01T10:00:00Z") }),
      order({ status: "cancelled", statusChangedAt: new Date("2026-10-03T08:00:00Z"), updatedAt: new Date("2026-10-03T08:00:00Z") }),
    ]);
    expect(deleteAt).toEqual(new Date("2026-10-04T08:00:00Z"));
  });

  it("uses updatedAt when it is later than statusChangedAt (some status writers don't set it)", () => {
    const deleteAt = customerAccountDeleteAt([
      order({ statusChangedAt: new Date("2026-10-01T10:00:00Z"), updatedAt: new Date("2026-10-05T10:00:00Z") }),
    ]);
    expect(deleteAt).toEqual(new Date("2026-10-06T10:00:00Z"));
  });

  it("uses updatedAt when statusChangedAt is missing", () => {
    expect(customerAccountDeleteAt([order({ statusChangedAt: null })])).toEqual(new Date("2026-10-02T10:00:00Z"));
  });

  it("deletes an account with no orders right away", () => {
    expect(customerAccountDeleteAt([], 1, new Date("2026-10-05T00:00:00Z"))).toEqual(new Date("2026-10-05T00:00:00Z"));
  });
});

describe("isCustomerAccountExpired", () => {
  const orders = [order()];

  it("is not expired just before deleteAt", () => {
    expect(isCustomerAccountExpired(orders, new Date("2026-10-02T09:59:59Z"))).toBe(false);
  });

  it("is expired exactly at deleteAt", () => {
    expect(isCustomerAccountExpired(orders, new Date("2026-10-02T10:00:00Z"))).toBe(true);
  });

  it("is never expired while an order is open", () => {
    expect(isCustomerAccountExpired([order({ status: "approved" })], new Date("2030-01-01T00:00:00Z"))).toBe(false);
  });
});
