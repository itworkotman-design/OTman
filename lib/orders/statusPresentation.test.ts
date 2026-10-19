import { describe, expect, it } from "vitest";
import {
  WEBSITE_ORDER_FILTER_STATUS_OPTIONS,
  WEBSITE_ORDER_STATUS_OPTIONS,
  getOrderStatusStyle,
  isAllowedWebsiteOrderStatus,
  isWebsiteOrderLocked,
  normalizeOrderStatus,
} from "@/lib/orders/statusPresentation";

describe("WEBSITE_ORDER_STATUS_OPTIONS", () => {
  it("is the prepaid homepage-order lifecycle, in display order", () => {
    expect(WEBSITE_ORDER_STATUS_OPTIONS).toEqual(["processing", "rejected", "confirmed", "active", "failed", "cancelled", "completed"]);
  });
});

describe("isAllowedWebsiteOrderStatus", () => {
  it("accepts the website statuses, including Norwegian/legacy aliases", () => {
    expect(isAllowedWebsiteOrderStatus("completed")).toBe(true);
    expect(isAllowedWebsiteOrderStatus("Avvist")).toBe(true);
    expect(isAllowedWebsiteOrderStatus("fail")).toBe(true);
  });

  it("rejects B2B-only and payment-link statuses", () => {
    for (const status of ["approved", "invoiced", "paid", "", "nonsense"]) {
      expect(isAllowedWebsiteOrderStatus(status)).toBe(false);
    }
  });
});

describe("refunded", () => {
  it("is recognised, including the Norwegian spelling", () => {
    expect(normalizeOrderStatus("Refundert")).toBe("refunded");
    expect(getOrderStatusStyle("refunded")).not.toEqual(getOrderStatusStyle("nonsense"));
  });

  it("can't be picked as a status — only the Decline action sets it, after the money went back", () => {
    expect(WEBSITE_ORDER_STATUS_OPTIONS).not.toContain("refunded");
    expect(isAllowedWebsiteOrderStatus("refunded")).toBe(false);
  });
});

describe("WEBSITE_ORDER_FILTER_STATUS_OPTIONS", () => {
  it("is every pickable website status plus refunded, so declined orders can be found", () => {
    expect(WEBSITE_ORDER_FILTER_STATUS_OPTIONS).toEqual([...WEBSITE_ORDER_STATUS_OPTIONS, "refunded"]);
  });
});

describe("isWebsiteOrderLocked", () => {
  it.each(["completed", "cancelled", "refunded", "invoiced", "paid", "Ferdig", "kanselert"])("%s can't be edited any more", (status) => {
    expect(isWebsiteOrderLocked(status)).toBe(true);
  });

  it.each(["processing", "rejected", "confirmed", "active", "failed", "", null])("%s can still be edited", (status) => {
    expect(isWebsiteOrderLocked(status)).toBe(false);
  });
});
