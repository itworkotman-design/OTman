import { describe, expect, it } from "vitest";
import {
  PARTNER_REQUIRED_STATUSES,
  findOrdersMissingPartner,
  hasPartner,
  isPartnerTrackedOrder,
  PARTNER_TRACKING_MIN_DISPLAY_ID,
  requiresPartner,
  shouldPromptForPartner,
} from "./partnerRequirement";

describe("requiresPartner", () => {
  it("is true for failed, completed, invoiced and paid", () => {
    for (const status of PARTNER_REQUIRED_STATUSES) {
      expect(requiresPartner(status)).toBe(true);
    }
  });

  it("normalizes case and legacy Norwegian names", () => {
    expect(requiresPartner("Completed")).toBe(true);
    expect(requiresPartner("ferdig")).toBe(true);
    expect(requiresPartner("fakturert")).toBe(true);
    expect(requiresPartner("betalt")).toBe(true);
    expect(requiresPartner("feilet")).toBe(true);
  });

  it("is false for other statuses and empty values", () => {
    expect(requiresPartner("processing")).toBe(false);
    expect(requiresPartner("confirmed")).toBe(false);
    expect(requiresPartner("cancelled")).toBe(false);
    expect(requiresPartner("")).toBe(false);
    expect(requiresPartner(null)).toBe(false);
  });
});

describe("hasPartner", () => {
  it("accepts a membership id or a non-empty legacy name", () => {
    expect(hasPartner({ subcontractorMembershipId: "m1", subcontractor: null })).toBe(true);
    expect(hasPartner({ subcontractorMembershipId: null, subcontractor: "Acme" })).toBe(true);
  });

  it("rejects missing or blank values", () => {
    expect(hasPartner({ subcontractorMembershipId: null, subcontractor: null })).toBe(false);
    expect(hasPartner({ subcontractorMembershipId: "", subcontractor: "  " })).toBe(false);
    expect(hasPartner({})).toBe(false);
  });
});

describe("isPartnerTrackedOrder", () => {
  it("tracks app orders from display id 20000 up", () => {
    expect(PARTNER_TRACKING_MIN_DISPLAY_ID).toBe(20000);
    expect(isPartnerTrackedOrder(20000)).toBe(true);
    expect(isPartnerTrackedOrder(22593)).toBe(true);
  });

  it("ignores legacy orders imported from before the app", () => {
    expect(isPartnerTrackedOrder(19999)).toBe(false);
    expect(isPartnerTrackedOrder(1500)).toBe(false);
  });

  it("tracks orders without a display id yet (new orders)", () => {
    expect(isPartnerTrackedOrder(undefined)).toBe(true);
    expect(isPartnerTrackedOrder(null)).toBe(true);
  });
});

describe("shouldPromptForPartner", () => {
  it("does not prompt for legacy orders", () => {
    expect(
      shouldPromptForPartner({ status: "completed", initialStatus: "confirmed", subcontractorId: "", displayId: 1234 }),
    ).toBe(false);
  });

  it("prompts when status changes into a partner-required status with no partner", () => {
    expect(
      shouldPromptForPartner({ status: "completed", initialStatus: "confirmed", subcontractorId: "" }),
    ).toBe(true);
  });

  it("does not prompt when a partner is set", () => {
    expect(
      shouldPromptForPartner({ status: "completed", initialStatus: "confirmed", subcontractorId: "m1" }),
    ).toBe(false);
  });

  it("does not prompt when the status did not change", () => {
    expect(
      shouldPromptForPartner({ status: "completed", initialStatus: "ferdig", subcontractorId: "" }),
    ).toBe(false);
  });

  it("does not prompt for statuses that do not require a partner", () => {
    expect(
      shouldPromptForPartner({ status: "cancelled", initialStatus: "confirmed", subcontractorId: "" }),
    ).toBe(false);
  });

  it("prompts when moving between two partner-required statuses", () => {
    expect(
      shouldPromptForPartner({ status: "invoiced", initialStatus: "completed", subcontractorId: "" }),
    ).toBe(true);
  });
});

describe("findOrdersMissingPartner", () => {
  it("ignores legacy orders", () => {
    const result = findOrdersMissingPartner([
      { id: "legacy", displayId: 1234, subcontractorMembershipId: null, subcontractor: null },
      { id: "app", displayId: 20010, subcontractorMembershipId: null, subcontractor: null },
    ]);

    expect(result.map((order) => order.id)).toEqual(["app"]);
  });

  it("returns only orders without a partner", () => {
    const result = findOrdersMissingPartner([
      { id: "a", displayId: 20001, subcontractorMembershipId: "m1", subcontractor: "X" },
      { id: "b", displayId: 20002, subcontractorMembershipId: null, subcontractor: null },
      { id: "c", displayId: 20003, subcontractorMembershipId: null, subcontractor: "Legacy" },
      { id: "d", displayId: 20004, subcontractorMembershipId: null, subcontractor: "" },
    ]);

    expect(result.map((order) => order.id)).toEqual(["b", "d"]);
  });
});
