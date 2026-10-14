"use client";

import { useState, type ReactNode } from "react";
import {
  PRESET_TIME_WINDOWS,
  buildTimeWindowValue,
  parseTimeWindowValue,
  type PresetTimeWindow,
} from "@/lib/booking/timeWindows";

// The dashboard-style pieces both "Edit order" tabs are built from
// (WebsiteOrderEditTab for a delivery, MovingOrderEditTab for a move).

// Top of a pickup / delivery / customer card: a round blue badge (a number or
// an icon), the title, and a one-line summary of what's filled in.
export function CardHeading({ icon, title, summary, action }: { icon: ReactNode; title: string; summary: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-logoblue text-sm font-semibold text-white [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-black/80">{title}</p>
          {summary && <p className="truncate text-xs text-black/50">{summary}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// A toggle button for picking one of a few options (type, time window).
export function ChoiceButton({
  selected,
  onClick,
  wide = false,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors ${wide ? "" : "px-4"} ${
        selected ? "border-logoblue bg-logoblue/10 text-logoblue" : "border-neutral-200 text-black/60 hover:border-logoblue/50"
      }`}
    >
      {children}
    </button>
  );
}

// The time window as the delivery Edit tab asks it: the presets, "Custom time"
// with any from/to (admins aren't limited like customers, saved as
// "HH:MM-HH:MM"), and an older free-text window kept as its own option.
export function TimeWindowChoice({
  value,
  onChange,
  t,
  labelClass,
  fieldClass,
}: {
  value: string;
  onChange: (timeWindow: string) => void;
  t: (en: string, no: string) => string;
  labelClass: string;
  fieldClass: string;
}) {
  // Kept while "Custom time" is chosen, even half-filled ("12:00-" can't be read back as a range).
  const [customTime, setCustomTime] = useState<{ from: string; to: string } | null>(() => {
    const stored = parseTimeWindowValue(value);
    return stored.selectedTimeWindow === "custom" ? { from: stored.customTimeFrom, to: stored.customTimeTo } : null;
  });
  const stored = parseTimeWindowValue(value);
  const legacyTimeWindow =
    !customTime &&
    stored.selectedTimeWindow &&
    stored.selectedTimeWindow !== "custom" &&
    !PRESET_TIME_WINDOWS.includes(stored.selectedTimeWindow as PresetTimeWindow)
      ? stored.selectedTimeWindow
      : null;

  function setCustomRange(range: { from: string; to: string }) {
    setCustomTime(range);
    onChange(buildTimeWindowValue({ selectedTimeWindow: "custom", customTimeFrom: range.from, customTimeTo: range.to }));
  }

  return (
    <div>
      <span className={labelClass}>{t("Time window", "Tidsvindu")}</span>
      <div className="grid grid-cols-1 gap-2 sm:auto-cols-fr sm:grid-flow-col">
        {[...(legacyTimeWindow ? [legacyTimeWindow] : []), ...PRESET_TIME_WINDOWS].map((window) => (
          <ChoiceButton
            key={window}
            wide
            selected={!customTime && value === window}
            onClick={() => {
              setCustomTime(null);
              onChange(window);
            }}
          >
            {window}
          </ChoiceButton>
        ))}
        <ChoiceButton wide selected={!!customTime} onClick={() => setCustomRange(customTime ?? { from: "", to: "" })}>
          {t("Custom time", "Eget tidspunkt")}
        </ChoiceButton>
      </div>
      {customTime && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label>
            <span className={labelClass}>{t("From", "Fra")}</span>
            <input type="time" className={fieldClass} value={customTime.from} onChange={(e) => setCustomRange({ ...customTime, from: e.target.value })} />
          </label>
          <label>
            <span className={labelClass}>{t("To", "Til")}</span>
            <input type="time" className={fieldClass} value={customTime.to} onChange={(e) => setCustomRange({ ...customTime, to: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}
