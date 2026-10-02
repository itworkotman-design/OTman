"use client";

import { useState } from "react";
import { BuildingIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { getChargeableFloors } from "@/lib/booking/pricing/buildWhiteGoodsCalculatorBreakdowns";
import { ChevronDownIcon, ChevronUpIcon, LiftIcon, QuestionMarkIcon } from "./orderDetailsIcons";
import { FieldLabel, fieldClass, sideColumnClass } from "./formFieldStyles";
import { parseFloorInput, sanitizeFloorText, stepFloor } from "./floorValue";

function formatKr(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

// A floor number field with a stacked up/down chevron stepper on the right,
// instead of the browser's default (and inconsistently styled) number spinner.
// Starts empty (null); accepts only digits and a leading minus (basements),
// never 0 — see floorValue.ts.
function FloorInput({
  value,
  onChange,
  onBlur,
  hasError,
  placeholder,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  hasError: boolean;
  placeholder: string;
}) {
  // The box's own text, so in-between states like a lone "-" survive while
  // typing. Re-synced whenever the floor changes from outside (the stepper).
  const [text, setText] = useState(value === null ? "" : String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (parseFloorInput(text) !== value) setText(value === null ? "" : String(value));
  }

  return (
    <div className="relative">
      <input
        type="text"
        // Full keyboard, not a numeric keypad: iOS's keypad has no minus key,
        // and basements are negative floors.
        inputMode="text"
        value={text}
        onChange={(e) => {
          const next = sanitizeFloorText(e.target.value);
          const floor = parseFloorInput(next);
          setText(next);
          setSyncedValue(floor);
          onChange(floor);
        }}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`${fieldClass(hasError)} pr-9`}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-black/10">
        <button
          type="button"
          aria-label="Increase"
          onClick={() => onChange(stepFloor(value, 1))}
          className="grid h-4 w-6 place-items-center text-black/40 transition hover:bg-black/5 hover:text-black/70"
        >
          <ChevronUpIcon className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => onChange(stepFloor(value, -1))}
          className="grid h-4 w-6 place-items-center border-t border-black/10 text-black/40 transition hover:bg-black/5 hover:text-black/70 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronDownIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function LiftCheckbox({
  locale,
  checked,
  onChange,
}: {
  locale: Locale;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <span className="flex items-center gap-1.5 font-medium text-black/75">
        <span className="text-black/40">
          <LiftIcon className="h-4 w-4" />
        </span>
        {t("Lift available", "Heis tilgjengelig")}
        <span
          title={t(
            "Is there a lift we can use to move the items?",
            "Er det en heis vi kan bruke til å flytte varene?",
          )}
          tabIndex={0}
          className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-black/30 hover:text-black/50"
        >
          <QuestionMarkIcon className="h-3.5 w-3.5" />
        </span>
      </span>
    </label>
  );
}

// A floor number + lift checkbox, paired together — used for both the
// pickup floor (PickupContactCard, private/business only) and the delivery
// floor (OrderDetailsCard).
export function FloorLiftField({
  locale,
  label,
  hint,
  floorValue,
  onFloorChange,
  onFloorBlur,
  hasError = false,
  liftChecked,
  onLiftChange,
  surchargePerFloor,
}: {
  locale: Locale;
  label: string;
  // Overrides the default "1 is the ground floor." tooltip — pass this where
  // the floor affects the price (see getChargeableFloors) so the customer is
  // warned before they see a surprise surcharge.
  hint?: string;
  // Counts from 1 (ground floor); null until chosen — see floorValue.ts.
  floorValue: number | null;
  onFloorChange: (value: number | null) => void;
  onFloorBlur?: () => void;
  // Red state for the required floor left empty — the caller decides when
  // (touched + still empty), same as the other required fields.
  hasError?: boolean;
  liftChecked: boolean;
  onLiftChange: (value: boolean) => void;
  // Customer-facing price per chargeable floor (see getChargeableFloors) —
  // when set, shows a live running surcharge next to the input so the
  // customer sees the extra cost before it shows up in the order summary.
  surchargePerFloor?: number;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const chargeableFloors = getChargeableFloors(floorValue ?? 0, liftChecked);
  const surcharge = surchargePerFloor ? chargeableFloors * surchargePerFloor : 0;

  return (
    // Lift checkbox sits beside the floor input (level with it, not its
    // label), wrapping under it only when there's no room.
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <label className="block min-w-40 flex-1">
        <FieldLabel icon={<BuildingIcon />} hint={hint ?? t("1 is the ground floor, -1 the basement.", "1. etasje er bakkeplan, -1 er kjeller.")}>
          {label}
        </FieldLabel>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <FloorInput
              value={floorValue}
              onChange={onFloorChange}
              onBlur={onFloorBlur}
              hasError={hasError}
              placeholder={t("e.g. 1 for the ground floor", "f.eks. 1 for bakkeplan")}
            />
          </div>
          {surcharge > 0 && (
            <span
              title={t(
                (floorValue ?? 0) < 0
                  ? `Surcharge for ${chargeableFloors} floor(s) below the 1st basement, no lift.`
                  : `Surcharge for ${chargeableFloors} floor(s) above the 2nd, no lift.`,
                (floorValue ?? 0) < 0
                  ? `Tillegg for ${chargeableFloors} etasje(r) under -1, uten heis.`
                  : `Tillegg for ${chargeableFloors} etasje(r) over 2., uten heis.`,
              )}
              className="shrink-0 whitespace-nowrap rounded-lg bg-amber-50 px-2.5 py-2 text-sm font-semibold text-amber-700"
            >
              +{formatKr(surcharge)}
            </span>
          )}
        </div>
      </label>
      <div className={`flex h-11 items-center ${sideColumnClass}`}>
        <LiftCheckbox locale={locale} checked={liftChecked} onChange={onLiftChange} />
      </div>
    </div>
  );
}
