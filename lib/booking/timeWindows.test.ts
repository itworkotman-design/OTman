import { describe, expect, it } from "vitest";
import { PRESET_TIME_WINDOWS, buildTimeWindowValue, parseTimeWindowValue } from "./timeWindows";

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
