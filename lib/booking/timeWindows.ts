// Shared source of truth for the two fixed delivery/pickup time windows the
// business offers, plus a "request a specific time" custom option — used by
// both the dashboard order editor (BookingEditor) and the public booking
// flows so the two never drift apart.
export const PRESET_TIME_WINDOWS = ["10:00-16:00", "16:00-21:00"] as const;
export type PresetTimeWindow = (typeof PRESET_TIME_WINDOWS)[number];

export type TimeWindowSelection = {
  // A preset value, "custom" for a specific requested time, or "" for none.
  selectedTimeWindow: string;
  customTimeFrom: string;
  customTimeTo: string;
};

const EMPTY_SELECTION: TimeWindowSelection = {
  selectedTimeWindow: "",
  customTimeFrom: "",
  customTimeTo: "",
};

// Parses the plain string stored on the order (a preset, an "HH:MM-HH:MM"
// custom range, or legacy free text) back into the selector's UI state.
export function parseTimeWindowValue(value: string | null | undefined): TimeWindowSelection {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return EMPTY_SELECTION;
  }

  if (PRESET_TIME_WINDOWS.includes(normalized as PresetTimeWindow)) {
    return { selectedTimeWindow: normalized, customTimeFrom: "", customTimeTo: "" };
  }

  const rangeMatch = normalized.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!rangeMatch) {
    return { selectedTimeWindow: normalized, customTimeFrom: "", customTimeTo: "" };
  }

  const [, from, to] = rangeMatch;
  return { selectedTimeWindow: "custom", customTimeFrom: from, customTimeTo: to };
}

// Inverse of parseTimeWindowValue: collapses the selector's UI state back
// into the single string stored on the order.
export function buildTimeWindowValue(selection: TimeWindowSelection): string {
  if (selection.selectedTimeWindow === "custom") {
    return `${selection.customTimeFrom}-${selection.customTimeTo}`;
  }

  return selection.selectedTimeWindow;
}
