import { describe, expect, it } from "vitest";
import { WEBSITE_ORDER_STATUS_OPTIONS, isAllowedWebsiteOrderStatus } from "@/lib/orders/statusPresentation";

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
