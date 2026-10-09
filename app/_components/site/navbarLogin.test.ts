import { describe, expect, it } from "vitest";
import { showsDashboardLogin } from "./navbarLogin";

describe("showsDashboardLogin", () => {
  it("hides the dashboard Login button on every My order page — those customers have their own login", () => {
    expect(showsDashboardLogin("/no/min-bestilling")).toBe(false);
    expect(showsDashboardLogin("/en/min-bestilling/K7MQ4XZ2")).toBe(false);
    expect(showsDashboardLogin("/no/min-bestilling/logg-inn")).toBe(false);
  });

  it("shows it everywhere else", () => {
    expect(showsDashboardLogin("/no")).toBe(true);
    expect(showsDashboardLogin("/no/kontakt")).toBe(true);
    expect(showsDashboardLogin("/no/min-bestillingxyz")).toBe(true);
    expect(showsDashboardLogin(null)).toBe(true);
  });
});
