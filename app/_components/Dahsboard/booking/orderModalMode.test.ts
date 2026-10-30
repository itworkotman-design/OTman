import { describe, expect, it } from "vitest";
import { orderModalMode, usesWebsiteOrderModal } from "./orderModalMode";

describe("orderModalMode", () => {
  it("opens a homepage website order in the website modal", () => {
    expect(orderModalMode(200, { ok: true, order: { id: "o1" } })).toBe("website");
  });

  it("opens any other order in the regular modal", () => {
    expect(orderModalMode(404, { ok: false, reason: "NOT_WHITE_GOODS_WEBSITE_ORDER" })).toBe("standard");
    expect(orderModalMode(404, { ok: false, reason: "NOT_FOUND" })).toBe("standard");
    // No access to website orders: the regular modal decides what they may see.
    expect(orderModalMode(403, { ok: false, reason: "FORBIDDEN" })).toBe("standard");
  });

  it("never falls back to the regular modal on a failure — that would open a website order in the wrong editor", () => {
    expect(orderModalMode(500, { ok: false, reason: "INTERNAL" })).toBe("error");
    expect(orderModalMode(500, null)).toBe("error");
    expect(orderModalMode(502, null)).toBe("error");
    expect(orderModalMode(null, null)).toBe("error");
  });
});

describe("usesWebsiteOrderModal", () => {
  // These rows skip the Alert Center's "Edit order" tab (the regular editor
  // would re-price them with dashboard pricing) and open DashboardOrderModal.
  it.each(["WHITE_GOODS", "MOVING", "SERVICE"])("is true for a homepage %s order", (kind) => {
    expect(usesWebsiteOrderModal({ websiteOrderKind: kind })).toBe(true);
  });

  it.each([null, undefined, ""])("is false without a website order kind (%s)", (kind) => {
    expect(usesWebsiteOrderModal({ websiteOrderKind: kind })).toBe(false);
  });
});
