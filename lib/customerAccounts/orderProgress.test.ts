import { describe, expect, it } from "vitest";
import { buildOrderProgress } from "./orderProgress";

const createdAt = new Date("2026-10-10T10:14:00Z");
const base = { createdAt, statusEvents: [] };
const at = (iso: string) => new Date(`2026-10-${iso}Z`);

function stepState(progress: ReturnType<typeof buildOrderProgress>) {
  return progress.steps.map((step) => `${step.key}:${step.state}`);
}

describe("buildOrderProgress", () => {
  it("a new order is received and goes straight into review", () => {
    const progress = buildOrderProgress({ ...base, status: "processing" });

    expect(stepState(progress)).toEqual(["received:done", "review:current", "confirmed:upcoming", "onTheWay:upcoming", "completed:upcoming"]);
    expect(progress.steps[0].at).toEqual(createdAt);
    expect(progress.steps[1].at).toEqual(createdAt);
    expect(progress.note).toBeNull();
  });

  it("is confirmed once staff approve or confirm it, stamped with when", () => {
    for (const status of ["confirmed", "approved", "Bekreftet"]) {
      const progress = buildOrderProgress({ ...base, status, statusEvents: [{ toStatus: status, createdAt: at("10T11:02:00") }] });

      expect(stepState(progress)).toEqual(["received:done", "review:done", "confirmed:done", "onTheWay:upcoming", "completed:upcoming"]);
      expect(progress.steps[2].at).toEqual(at("10T11:02:00"));
    }
  });

  it("is on the way when the order is active", () => {
    const progress = buildOrderProgress({ ...base, status: "active", statusEvents: [{ toStatus: "active", createdAt: at("12T08:30:00") }] });

    expect(stepState(progress)).toEqual(["received:done", "review:done", "confirmed:done", "onTheWay:current", "completed:upcoming"]);
    expect(progress.steps[3].at).toEqual(at("12T08:30:00"));
    // Passed without its own status change: no time.
    expect(progress.steps[2].at).toBeNull();
  });

  it("is completed for completed, invoiced and paid", () => {
    for (const status of ["completed", "invoiced", "paid"]) {
      expect(buildOrderProgress({ ...base, status }).steps.every((step) => step.state === "done")).toBe(true);
    }
  });

  it("shows where the order is NOW when staff move it back", () => {
    const progress = buildOrderProgress({
      ...base,
      status: "processing",
      statusEvents: [
        { toStatus: "confirmed", createdAt: at("10T11:00:00") },
        { toStatus: "processing", createdAt: at("10T12:00:00") },
      ],
    });

    expect(stepState(progress)).toEqual(["received:done", "review:current", "confirmed:upcoming", "onTheWay:upcoming", "completed:upcoming"]);
  });

  it("uses the FIRST time a step was reached", () => {
    const progress = buildOrderProgress({
      ...base,
      status: "confirmed",
      statusEvents: [
        { toStatus: "confirmed", createdAt: at("10T11:00:00") },
        { toStatus: "processing", createdAt: at("10T12:00:00") },
        { toStatus: "confirmed", createdAt: at("10T13:00:00") },
      ],
    });

    expect(progress.steps[2].at).toEqual(at("10T11:00:00"));
  });

  describe("a cancelled order", () => {
    it("cancelled in review: the next step becomes Kansellert, and nothing comes after it", () => {
      const progress = buildOrderProgress({ ...base, status: "cancelled", statusEvents: [{ toStatus: "cancelled", createdAt: at("10T15:00:00") }] });

      expect(stepState(progress)).toEqual(["received:done", "review:done", "cancelled:stopped"]);
      expect(progress.steps[2].at).toEqual(at("10T15:00:00"));
      expect(progress.note).toBe("cancelled");
    });

    it("cancelled after it was confirmed: Kansellert takes On the way's place", () => {
      const progress = buildOrderProgress({
        ...base,
        status: "Kanselert",
        statusEvents: [
          { toStatus: "confirmed", createdAt: at("10T11:00:00") },
          { toStatus: "cancelled", createdAt: at("11T09:00:00") },
        ],
      });

      expect(stepState(progress)).toEqual(["received:done", "review:done", "confirmed:done", "cancelled:stopped"]);
      expect(progress.steps[2].at).toEqual(at("10T11:00:00"));
    });

    it("cancelled once on the way: it was not carried out (in Completed's place)", () => {
      const progress = buildOrderProgress({
        ...base,
        status: "cancelled",
        statusEvents: [
          { toStatus: "active", createdAt: at("12T08:30:00") },
          { toStatus: "cancelled", createdAt: at("12T10:00:00") },
        ],
      });

      expect(stepState(progress)).toEqual(["received:done", "review:done", "confirmed:done", "onTheWay:done", "notCompleted:stopped"]);
      expect(progress.steps[4].at).toEqual(at("12T10:00:00"));
      expect(progress.note).toBe("notCompleted");
    });

    it("judges how far it got by everything before the cancellation, not later moves", () => {
      const progress = buildOrderProgress({
        ...base,
        status: "cancelled",
        statusEvents: [
          { toStatus: "confirmed", createdAt: at("10T11:00:00") },
          { toStatus: "processing", createdAt: at("10T12:00:00") },
          { toStatus: "cancelled", createdAt: at("10T13:00:00") },
        ],
      });

      expect(stepState(progress)).toEqual(["received:done", "review:done", "confirmed:done", "cancelled:stopped"]);
    });

    it("without any history, counts as cancelled in review", () => {
      const progress = buildOrderProgress({ ...base, status: "cancelled" });

      expect(stepState(progress)).toEqual(["received:done", "review:done", "cancelled:stopped"]);
      expect(progress.steps[2].at).toBeNull();
    });
  });

  it("a failed order was on the way but not carried out", () => {
    const progress = buildOrderProgress({ ...base, status: "failed", statusEvents: [{ toStatus: "failed", createdAt: at("12T12:00:00") }] });

    expect(stepState(progress)).toEqual(["received:done", "review:done", "confirmed:done", "onTheWay:done", "notCompleted:stopped"]);
    expect(progress.steps[4].at).toEqual(at("12T12:00:00"));
  });

  it("a rejected order is still in review, flagged as needing a change", () => {
    const progress = buildOrderProgress({ ...base, status: "rejected", statusEvents: [{ toStatus: "rejected", createdAt: at("10T11:00:00") }] });

    expect(stepState(progress)).toEqual(["received:done", "needsChange:attention", "confirmed:upcoming", "onTheWay:upcoming", "completed:upcoming"]);
    expect(progress.steps[1].at).toEqual(at("10T11:00:00"));
    expect(progress.note).toBe("needsChange");
  });
});
