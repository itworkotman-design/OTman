import { describe, expect, it } from "vitest";
import { buildNoSubcontractorAlert } from "./noSubcontractorAlert";

describe("buildNoSubcontractorAlert", () => {
  it("keeps the original completed message by default", () => {
    const alert = buildNoSubcontractorAlert();

    expect(alert.message).toContain("marked as completed");
    expect(alert.payload.kind).toBe("NO_SUBCONTRACTOR_ON_COMPLETE");
  });

  it("describes an overdue order with its actual status", () => {
    const alert = buildNoSubcontractorAlert({ status: "invoiced", overdue: true });

    expect(alert.message).toContain("invoiced");
    expect(alert.message).toContain("more than a day");
    // Same kind so dedup is shared with the immediate on-complete alert.
    expect(alert.payload.kind).toBe("NO_SUBCONTRACTOR_ON_COMPLETE");
  });
});
