"use client";

import WebsiteDatePicker from "@/app/_components/utils/WebsiteDatePicker";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { addDaysIso, getOsloDateKey } from "@/lib/dates/isoDate";
import { isNorwegianPublicHoliday } from "@/lib/dates/norwayHolidays";
import { CalendarIcon, ClockIcon } from "./orderDetailsIcons";
import { FieldLabel, fieldClass } from "./formFieldStyles";
import { TimeWindowField } from "./timeWindowField";

type Props = {
  locale: Locale;
  preferredDate: string;
  setPreferredDate: (value: string) => void;
  timeWindow: string;
  setTimeWindow: (value: string) => void;
  // Red state for each required field — the caller decides when (touched +
  // still empty/incomplete).
  dateError?: boolean;
  timeWindowError?: boolean;
};

// "Requested date" + "Time window", side by side (stacked on phones). Shared
// by the delivery modal's order-details card and the moving flow's "When?"
// step, so both book on the same calendar rules: from tomorrow (Oslo time),
// never on a Sunday or a Norwegian public holiday.
export function DateTimeWindowFields({
  locale,
  preferredDate,
  setPreferredDate,
  timeWindow,
  setTimeWindow,
  dateError = false,
  timeWindowError = false,
}: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="block">
        <FieldLabel icon={<CalendarIcon className="h-4 w-4" />}>{t("Requested date", "Ønsket dato")}</FieldLabel>
        <WebsiteDatePicker
          value={preferredDate}
          onChange={setPreferredDate}
          locale={locale}
          placeholder={t("Select a date", "Velg en dato")}
          className={fieldClass(dateError)}
          minDate={addDaysIso(getOsloDateKey(), 1)}
          blockedWeekdays={[0]}
          isDateBlocked={isNorwegianPublicHoliday}
          // The last field of a long modal: opening upward keeps the
          // calendar on screen instead of below the fold.
          openUpward
        />
      </label>
      <label className="block">
        <FieldLabel icon={<ClockIcon className="h-4 w-4" />}>{t("Time window", "Tidsvindu")}</FieldLabel>
        <TimeWindowField locale={locale} value={timeWindow} onChange={setTimeWindow} hasError={timeWindowError} />
      </label>
    </div>
  );
}
