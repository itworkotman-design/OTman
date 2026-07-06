import type { RecurrenceType } from "@prisma/client";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";

const WEEKDAY_LABELS: Record<BookingUiLocale, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  nb: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"],
};

// JS Date#getDay(): 0=Sun..6=Sat. Displayed Mon-first (ISO order) to match
// the rest of the booking UI's calendar/weekday conventions.
function weekdayLabel(jsDay: number, locale: BookingUiLocale): string {
  const isoIndex = (jsDay + 6) % 7;
  return WEEKDAY_LABELS[locale][isoIndex] ?? String(jsDay);
}

export function describeRecurrence(
  type: RecurrenceType,
  config: unknown,
  locale: BookingUiLocale = "en",
): string {
  if (type === "WEEKLY") {
    const weekdays = (config as { weekdays?: unknown })?.weekdays;
    const days = Array.isArray(weekdays)
      ? weekdays
          .filter((d): d is number => typeof d === "number")
          .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
          .map((d) => weekdayLabel(d, locale))
      : [];

    return locale === "nb"
      ? `Ukentlig: ${days.join(", ") || "–"}`
      : `Weekly: ${days.join(", ") || "-"}`;
  }

  if (type === "MONTHLY") {
    const dayOfMonth = (config as { dayOfMonth?: unknown })?.dayOfMonth;
    const day = typeof dayOfMonth === "number" ? dayOfMonth : null;

    return locale === "nb" ? `Månedlig: dag ${day ?? "–"}` : `Monthly: day ${day ?? "-"}`;
  }

  if (type === "CUSTOM_DATES") {
    const dates = (config as { dates?: unknown })?.dates;
    const count = Array.isArray(dates) ? dates.length : 0;

    return locale === "nb" ? `Egendefinert: ${count} datoer` : `Custom: ${count} dates`;
  }

  return locale === "nb" ? "Ukjent" : "Unknown";
}
