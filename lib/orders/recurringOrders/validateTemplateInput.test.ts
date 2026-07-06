import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateTemplateInput } from "./validateTemplateInput";

const FALLBACK = { membershipId: "membership-1", label: "Staff" };

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Weekly template",
    recurrenceType: "WEEKLY",
    recurrenceConfig: { weekdays: [1] },
    leadTimeDays: 3,
    startDate: "2026-07-01",
    endDate: null,
    orderDefaults: { productCards: [{ cardId: 1 }] },
    ...overrides,
  };
}

describe("validateTemplateInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a fully-specified body as-is", () => {
    const result = validateTemplateInput(validBody(), FALLBACK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Weekly template");
    expect(result.value.recurrenceType).toBe("WEEKLY");
    expect(result.value.leadTimeDays).toBe(3);
    expect(result.value.startDate).toBe("2026-07-01");
  });

  it("defaults a blank name instead of rejecting", () => {
    const result = validateTemplateInput(validBody({ name: "" }), FALLBACK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Untitled scheduler order");
  });

  it("defaults an invalid recurrenceType to WEEKLY instead of rejecting", () => {
    const result = validateTemplateInput(validBody({ recurrenceType: "YEARLY" }), FALLBACK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.recurrenceType).toBe("WEEKLY");
  });

  it("rejects a missing recurrenceConfig (recurrence selection stays mandatory)", () => {
    const result = validateTemplateInput(
      validBody({ recurrenceType: "CUSTOM_DATES", recurrenceConfig: undefined }),
      FALLBACK,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("RECURRENCE_SELECTION_REQUIRED");
  });

  it("rejects an empty WEEKLY selection (no weekdays picked yet)", () => {
    const result = validateTemplateInput(validBody({ recurrenceConfig: { weekdays: [] } }), FALLBACK);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("RECURRENCE_SELECTION_REQUIRED");
  });

  it("rejects an empty CUSTOM_DATES selection (no dates picked yet)", () => {
    const result = validateTemplateInput(
      validBody({ recurrenceType: "CUSTOM_DATES", recurrenceConfig: { dates: [] } }),
      FALLBACK,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("RECURRENCE_SELECTION_REQUIRED");
  });

  it("accepts a valid non-empty MONTHLY selection", () => {
    const result = validateTemplateInput(
      validBody({ recurrenceType: "MONTHLY", recurrenceConfig: { dayOfMonth: 15 } }),
      FALLBACK,
    );
    expect(result.ok).toBe(true);
  });

  it("defaults an invalid leadTimeDays to 0 instead of rejecting", () => {
    const result = validateTemplateInput(validBody({ leadTimeDays: -5 }), FALLBACK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.leadTimeDays).toBe(0);
  });

  it("defaults a missing/invalid startDate to today instead of rejecting", () => {
    const result = validateTemplateInput(validBody({ startDate: "not-a-date" }), FALLBACK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.startDate).toBe("2026-07-06");
  });

  it("nulls out an invalid endDate instead of rejecting", () => {
    const result = validateTemplateInput(validBody({ endDate: "not-a-date" }), FALLBACK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.endDate).toBeNull();
  });

  it("nulls out an endDate before the startDate instead of rejecting", () => {
    const result = validateTemplateInput(
      validBody({ startDate: "2026-07-10", endDate: "2026-07-01" }),
      FALLBACK,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.endDate).toBeNull();
  });

  it("still rejects an empty product card list", () => {
    const result = validateTemplateInput(validBody({ orderDefaults: { productCards: [] } }), FALLBACK);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.reason).toBe("INVALID_PRODUCT_CARDS");
  });

  it("falls back to the creator's own membership when no customer is chosen", () => {
    const result = validateTemplateInput(validBody(), FALLBACK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.orderDefaults).toMatchObject({
      customerMembershipId: FALLBACK.membershipId,
      customerLabel: FALLBACK.label,
    });
  });
});
