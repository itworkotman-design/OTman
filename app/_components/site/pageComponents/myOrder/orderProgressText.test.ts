import { describe, expect, it } from "vitest";
import { buildOrderProgress } from "@/lib/customerAccounts/orderProgress";
import { STEP_LABELS, formatStepTime, paymentBadge, progressBadge } from "./orderProgressText";

const createdAt = new Date("2026-10-10T10:14:00Z");
const progress = (status: string, statusEvents: { toStatus: string; createdAt: Date }[] = []) =>
  buildOrderProgress({ status, createdAt, statusEvents });

describe("progressBadge", () => {
  it("names the step the order is at", () => {
    expect(progressBadge(progress("processing"), "no").label).toBe("Under behandling");
    expect(progressBadge(progress("confirmed"), "no").label).toBe("Bekreftet");
    expect(progressBadge(progress("active"), "no").label).toBe("På vei");
    expect(progressBadge(progress("completed"), "en").label).toBe("Completed");
  });

  it("names where it stopped, or that it needs a change", () => {
    expect(progressBadge(progress("cancelled"), "no").label).toBe("Kansellert");
    expect(progressBadge(progress("failed"), "no").label).toBe("Ikke gjennomført");
    expect(progressBadge(progress("rejected"), "no").label).toBe("Trenger endring");
  });

  it("is red for a stopped order and orange when it needs a change", () => {
    expect(progressBadge(progress("cancelled"), "no").className).toContain("red");
    expect(progressBadge(progress("rejected"), "no").className).toContain("orange");
  });
});

describe("STEP_LABELS", () => {
  it("has the five steps in Norwegian", () => {
    expect([STEP_LABELS.received.no, STEP_LABELS.review.no, STEP_LABELS.confirmed.no, STEP_LABELS.onTheWay.no, STEP_LABELS.completed.no]).toEqual([
      "Bestilling mottatt",
      "Under behandling",
      "Bekreftet",
      "På vei",
      "Fullført",
    ]);
  });
});

describe("formatStepTime", () => {
  it("is the Oslo date and time", () => {
    expect(formatStepTime(createdAt, "no")).toBe("10. okt. 12:14");
  });
});

describe("paymentBadge", () => {
  it("names each payment state in both languages", () => {
    expect(paymentBadge("paid", "no").label).toBe("Betalt");
    expect(paymentBadge("due", "no").label).toBe("Venter på betaling");
    expect(paymentBadge("refund", "no").label).toBe("Refusjon på vei");
    expect(paymentBadge("due", "en").label).toBe("Awaiting payment");
  });

  it("is green when paid, amber while waiting for payment", () => {
    expect(paymentBadge("paid", "en").className).toContain("emerald");
    expect(paymentBadge("due", "en").className).toContain("amber");
  });
});
