import { describe, expect, it } from "vitest";
import { PRESET_TIME_WINDOWS, buildTimeWindowValue, isTimeWindowComplete, parseTimeWindowValue } from "./timeWindows";

describe("parseTimeWindowValue", () => {
  it("returns an empty selection for an empty value", () => {
    expect(parseTimeWindowValue("")).toEqual({
      selectedTimeWindow: "",
      customTimeFrom: "",
      customTimeTo: "",
    });
    expect(parseTimeWindowValue(undefined)).toEqual({
      selectedTimeWindow: "",
      customTimeFrom: "",
      customTimeTo: "",
    });
  });

  it("recognizes a preset time window", () => {
    for (const preset of PRESET_TIME_WINDOWS) {
      expect(parseTimeWindowValue(preset)).toEqual({
        selectedTimeWindow: preset,
        customTimeFrom: "",
        customTimeTo: "",
      });
    }
  });

  it("splits a custom HH:MM-HH:MM range", () => {
    expect(parseTimeWindowValue("09:30-11:45")).toEqual({
      selectedTimeWindow: "custom",
      customTimeFrom: "09:30",
      customTimeTo: "11:45",
    });
  });

  it("treats an unrecognized non-range string as a legacy free-text value", () => {
    expect(parseTimeWindowValue("morning")).toEqual({
      selectedTimeWindow: "morning",
      customTimeFrom: "",
      customTimeTo: "",
    });
  });

  it("trims whitespace before parsing", () => {
    expect(parseTimeWindowValue("  10:00-16:00  ")).toEqual({
      selectedTimeWindow: "10:00-16:00",
      customTimeFrom: "",
      customTimeTo: "",
    });
  });
});

describe("buildTimeWindowValue", () => {
  it("passes a preset selection through unchanged", () => {
    expect(
      buildTimeWindowValue({ selectedTimeWindow: "10:00-16:00", customTimeFrom: "", customTimeTo: "" }),
    ).toBe("10:00-16:00");
  });

  it("joins the custom from/to into a single range", () => {
    expect(
      buildTimeWindowValue({ selectedTimeWindow: "custom", customTimeFrom: "09:30", customTimeTo: "11:45" }),
    ).toBe("09:30-11:45");
  });

  it("round-trips through parseTimeWindowValue", () => {
    const original = "16:00-21:00";
    expect(buildTimeWindowValue(parseTimeWindowValue(original))).toBe(original);

    const custom = "08:15-10:00";
    expect(buildTimeWindowValue(parseTimeWindowValue(custom))).toBe(custom);
  });
});

describe("isTimeWindowComplete", () => {
  it("accepts a preset window", () => {
    expect(isTimeWindowComplete(PRESET_TIME_WINDOWS[0])).toBe(true);
  });

  it("accepts a specific time once both ends are chosen", () => {
    expect(isTimeWindowComplete("12:00-14:00")).toBe(true);
  });

  it("rejects nothing chosen, or a specific time missing either end", () => {
    expect(isTimeWindowComplete("")).toBe(false);
    expect(isTimeWindowComplete("-")).toBe(false);
    expect(isTimeWindowComplete("12:00-")).toBe(false);
    expect(isTimeWindowComplete("-14:00")).toBe(false);
  });
});

describe("isTimeWindowComplete — real times only", () => {
  it("rejects impossible clock times and a range that ends before it starts", () => {
    expect(isTimeWindowComplete("25:00-26:00")).toBe(false);
    expect(isTimeWindowComplete("12:60-13:00")).toBe(false);
    expect(isTimeWindowComplete("14:00-12:00")).toBe(false);
    expect(isTimeWindowComplete("12:00-12:00")).toBe(false);
  });

  it("still accepts a normal specific time", () => {
    expect(isTimeWindowComplete("08:30-23:59")).toBe(true);
  });
});
