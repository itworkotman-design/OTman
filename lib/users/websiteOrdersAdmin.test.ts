import { describe, expect, it } from "vitest";
import { isWebsiteOrdersAdmin } from "./access";

const access = (enabled: boolean, level: "VIEWER" | "ADMIN") => [{ module: "WEBSITE_ORDERS" as const, enabled, level }];

describe("isWebsiteOrdersAdmin — who may act on website orders' money and download the web-sales report", () => {
  it("is a company owner or admin regardless of module grants", () => {
    expect(isWebsiteOrdersAdmin({ role: "OWNER", appAccess: [] })).toBe(true);
    expect(isWebsiteOrdersAdmin({ role: "ADMIN", appAccess: [] })).toBe(true);
  });

  it("is a user only with Website orders enabled at ADMIN level", () => {
    expect(isWebsiteOrdersAdmin({ role: "USER", appAccess: access(true, "ADMIN") })).toBe(true);
    expect(isWebsiteOrdersAdmin({ role: "USER", appAccess: access(true, "VIEWER") })).toBe(false);
    expect(isWebsiteOrdersAdmin({ role: "USER", appAccess: access(false, "ADMIN") })).toBe(false);
    expect(isWebsiteOrdersAdmin({ role: "USER", appAccess: [] })).toBe(false);
  });
});
