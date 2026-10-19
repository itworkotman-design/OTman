import { describe, expect, it } from "vitest";
import { decidePaidOrderChange } from "./paidOrderChange";

// A paid order: 1000 ex. VAT, 1250 incl. VAT paid.
const base = {
  netPaidCents: 125000,
  previousPriceExVat: 1000,
  priceExVat: 1000,
  totalIncVat: 1250,
  beforeCutoff: true,
  status: "confirmed",
  mode: "customer" as const,
};

describe("decidePaidOrderChange", () => {
  it("an unpaid order just saves, whatever the price does (it's paid in full later)", () => {
    expect(decidePaidOrderChange({ ...base, netPaidCents: 0, priceExVat: 1400, totalIncVat: 1750 })).toEqual({ action: "save", reopen: false });
    expect(decidePaidOrderChange({ ...base, netPaidCents: 0, priceExVat: 600, totalIncVat: 750 })).toEqual({ action: "save", reopen: false });
  });

  it("a paid order that gets more expensive is paid first: the new total minus what's paid", () => {
    expect(decidePaidOrderChange({ ...base, priceExVat: 1200, totalIncVat: 1500 })).toEqual({ action: "payFirst", amountDueCents: 25000 });
  });

  it("…also within 24h (adding a service with the driver there)", () => {
    expect(decidePaidOrderChange({ ...base, beforeCutoff: false, status: "active", priceExVat: 1200, totalIncVat: 1500 })).toEqual({
      action: "payFirst",
      amountDueCents: 25000,
    });
  });

  it("charges any older balance too, since the customer pays what's due", () => {
    expect(decidePaidOrderChange({ ...base, netPaidCents: 100000, priceExVat: 1200, totalIncVat: 1500 })).toEqual({
      action: "payFirst",
      amountDueCents: 50000,
    });
  });

  it("saves a dearer change when it's already paid for (applying a paid change)", () => {
    expect(decidePaidOrderChange({ ...base, mode: "paid", netPaidCents: 150000, priceExVat: 1200, totalIncVat: 1500 })).toEqual({
      action: "save",
      reopen: false,
    });
  });

  it("saves a dearer change that the customer had already overpaid for", () => {
    expect(decidePaidOrderChange({ ...base, netPaidCents: 160000, priceExVat: 1200, totalIncVat: 1500 })).toEqual({ action: "save", reopen: false });
  });

  it("a cheaper paid order before the cutoff saves, and a confirmed one goes back to processing (refund on confirm)", () => {
    expect(decidePaidOrderChange({ ...base, priceExVat: 800, totalIncVat: 1000 })).toEqual({ action: "save", reopen: true });
    expect(decidePaidOrderChange({ ...base, status: "Bekreftet", priceExVat: 800, totalIncVat: 1000 })).toEqual({ action: "save", reopen: true });
    expect(decidePaidOrderChange({ ...base, status: "processing", priceExVat: 800, totalIncVat: 1000 })).toEqual({ action: "save", reopen: false });
  });

  it("a cheaper paid order within 24h is refused — only additions then", () => {
    expect(decidePaidOrderChange({ ...base, beforeCutoff: false, priceExVat: 800, totalIncVat: 1000 })).toEqual({
      action: "reject",
      reason: "WOULD_DECREASE_PRICE",
    });
  });

  it("an unchanged price just saves", () => {
    expect(decidePaidOrderChange(base)).toEqual({ action: "save", reopen: false });
  });
});
