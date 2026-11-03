"use client";

import { useRef, useState } from "react";
import {
  SIZE_DIMENSION_MAX_CM,
  SIZE_DIMENSION_MIN_CM,
  SIZE_DIMENSION_SCALE_MARKS_CM,
  SIZE_DIMENSION_STEP_CM,
  isAllowedDimensionCm,
  parseTypedDimensionCm,
} from "@/lib/booking/pricing/sizeDimensions";

const THUMB_PX = 22;

// Where a value sits along the track, matching the native range thumb's
// centre (which travels THUMB_PX less than the full width).
function trackPosition(cm: number) {
  const fraction = (cm - SIZE_DIMENSION_MIN_CM) / (SIZE_DIMENSION_MAX_CM - SIZE_DIMENSION_MIN_CM);
  return `calc(${fraction * 100}% + ${(0.5 - fraction) * THUMB_PX}px)`;
}

// One dimension (width / height / length) of a size-priced item: a ruler to
// drag along, with faint "about this many cm" marks behind it, and a box on
// the right showing the value — click it and type, and the ruler jumps there.
// Nothing is chosen until the customer drags or types (the box shows "—").
export function DimensionRuler({
  label,
  valueCm,
  onChange,
}: {
  label: string;
  valueCm: number | null;
  onChange: (valueCm: number) => void;
}) {
  // What's in the box while it's being typed in; null when not editing.
  const [draft, setDraft] = useState<string | null>(null);
  const chosen = valueCm !== null;
  // Escape leaves the box without applying what was typed.
  const cancelledRef = useRef(false);

  const commitDraft = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(null);
      return;
    }
    const parsed = draft === null ? null : parseTypedDimensionCm(draft);
    if (parsed !== null && parsed !== valueCm) onChange(parsed);
    setDraft(null);
  };

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-black/50">{label}</span>

      <div className="flex flex-1 items-center gap-3">
        <div className="relative h-11 flex-1">
          {/* The scale, behind the ruler. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-black/10" />
          {chosen && (
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-logoblue/60"
              style={{ width: trackPosition(valueCm) }}
            />
          )}
          {SIZE_DIMENSION_SCALE_MARKS_CM.map((cm) => (
            <div
              key={cm}
              aria-hidden
              className="pointer-events-none absolute top-0 flex h-full -translate-x-1/2 flex-col items-center justify-between"
              style={{ left: trackPosition(cm) }}
            >
              <span className="text-[10px] leading-none tabular-nums text-black/25">{cm}</span>
              <span className="h-2 w-px bg-black/15" />
              <span className="h-2.5" />
            </div>
          ))}

          <input
            type="range"
            min={SIZE_DIMENSION_MIN_CM}
            max={SIZE_DIMENSION_MAX_CM}
            step={SIZE_DIMENSION_STEP_CM}
            value={valueCm ?? SIZE_DIMENSION_MIN_CM}
            aria-label={`${label} (cm)`}
            aria-valuetext={chosen ? `${valueCm} cm` : undefined}
            onChange={(e) => onChange(Number(e.target.value))}
            className={[
              "relative z-10 h-full w-full cursor-pointer appearance-none bg-transparent",
              "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent",
              "[&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[22px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-logoblue [&::-webkit-slider-thumb]:shadow-md",
              "[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-logoblue [&::-moz-range-thumb]:shadow-md",
              "focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-logoblue/25",
            ].join(" ")}
          />
        </div>

        {/* The chosen value; click and type to set it exactly. */}
        <label
          className={[
            "flex h-10 w-24 shrink-0 items-center gap-1 rounded-lg border bg-white px-2.5 transition focus-within:border-logoblue focus-within:ring-2 focus-within:ring-logoblue/20",
            chosen ? "border-logoblue/40" : "border-black/15",
          ].join(" ")}
        >
          <input
            type="text"
            inputMode="numeric"
            aria-label={`${label} (cm)`}
            placeholder="—"
            value={draft ?? (chosen ? String(valueCm) : "")}
            onFocus={(e) => {
              setDraft(chosen ? String(valueCm) : "");
              e.target.select();
            }}
            onChange={(e) => {
              setDraft(e.target.value);
              // The ruler follows as they type a value on a 5 cm step;
              // anything else is rounded and clamped when they leave the box.
              const cm = Number(e.target.value.trim());
              if (isAllowedDimensionCm(cm) && cm !== valueCm) onChange(cm);
            }}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                cancelledRef.current = true;
                e.currentTarget.blur();
              }
            }}
            className="w-full min-w-0 bg-transparent text-right text-sm font-semibold tabular-nums text-black/85 outline-none placeholder:text-black/30"
          />
          <span className="text-xs text-black/45">cm</span>
        </label>
      </div>
    </div>
  );
}
