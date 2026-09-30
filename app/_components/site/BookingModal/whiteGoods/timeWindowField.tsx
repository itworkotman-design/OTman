"use client";

import { useState } from "react";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import {
  PRESET_TIME_WINDOWS,
  buildTimeWindowValue,
  parseTimeWindowValue,
  type TimeWindowSelection,
} from "@/lib/booking/timeWindows";
import { inputClass } from "./formFieldStyles";

type Props = {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
};

// The same two fixed pickup/delivery windows offered in the internal
// booking app, plus a "request a specific time" custom option — see
// PRESET_TIME_WINDOWS for the shared source of truth.
export function TimeWindowField({ locale, value, onChange }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const [selection, setSelection] = useState<TimeWindowSelection>(() => parseTimeWindowValue(value));

  const updateSelection = (next: Partial<TimeWindowSelection>) => {
    const merged = { ...selection, ...next };
    setSelection(merged);
    onChange(buildTimeWindowValue(merged));
  };

  return (
    <div className="flex flex-col gap-3">
      <select
        value={selection.selectedTimeWindow}
        onChange={(e) =>
          updateSelection({ selectedTimeWindow: e.target.value, customTimeFrom: "", customTimeTo: "" })
        }
        className={inputClass}
      >
        <option value="">{t("Choose", "Velg")}</option>
        {PRESET_TIME_WINDOWS.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
        <option value="custom">{t("Request a specific time", "Be om et spesifikt tidspunkt")}</option>
      </select>

      {selection.selectedTimeWindow === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-black/50">{t("From", "Fra")}</span>
            <input
              type="time"
              value={selection.customTimeFrom}
              onChange={(e) => updateSelection({ customTimeFrom: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-black/50">{t("To", "Til")}</span>
            <input
              type="time"
              value={selection.customTimeTo}
              onChange={(e) => updateSelection({ customTimeTo: e.target.value })}
              className={inputClass}
            />
          </label>
        </div>
      )}
    </div>
  );
}
