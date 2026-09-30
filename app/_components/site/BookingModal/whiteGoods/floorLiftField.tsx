"use client";

import { BuildingIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { ChevronDownIcon, ChevronUpIcon, LiftIcon, QuestionMarkIcon } from "./orderDetailsIcons";
import { FieldLabel, inputClass } from "./formFieldStyles";

// A floor number field with a stacked up/down chevron stepper on the right,
// instead of the browser's default (and inconsistently styled) number spinner.
function FloorInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="relative">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`${inputClass} pr-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-black/10">
        <button
          type="button"
          aria-label="Increase"
          onClick={() => onChange(value + 1)}
          className="grid h-4 w-6 place-items-center text-black/40 transition hover:bg-black/5 hover:text-black/70"
        >
          <ChevronUpIcon className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="grid h-4 w-6 place-items-center border-t border-black/10 text-black/40 transition hover:bg-black/5 hover:text-black/70"
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
  floorValue,
  onFloorChange,
  liftChecked,
  onLiftChange,
}: {
  locale: Locale;
  label: string;
  floorValue: number;
  onFloorChange: (value: number) => void;
  liftChecked: boolean;
  onLiftChange: (value: boolean) => void;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  return (
    <div className="flex flex-col gap-2">
      <label className="block">
        <FieldLabel icon={<BuildingIcon />} hint={t("Ground floor is 0.", "Bakkeplan er 0.")}>
          {label}
        </FieldLabel>
        <FloorInput value={floorValue} onChange={onFloorChange} />
      </label>
      <LiftCheckbox locale={locale} checked={liftChecked} onChange={onLiftChange} />
    </div>
  );
}
