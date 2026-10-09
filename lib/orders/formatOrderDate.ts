import type { Locale } from "@/lib/content/ServiceWindowContent";

// "2026-10-05" → "5. oktober 2026" / "5 October 2026". Read as a calendar
// date (UTC), not a local midnight, so it can't shift a day by timezone.
export function formatOrderDate(isoDate: string, locale: Locale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString(locale === "no" ? "nb-NO" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
