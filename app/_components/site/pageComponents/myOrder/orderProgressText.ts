import type { OrderProgress, OrderProgressStepKey } from "@/lib/customerAccounts/orderProgress";

type Locale = "no" | "en";

export const STEP_LABELS: Record<OrderProgressStepKey, { no: string; en: string }> = {
  received: { no: "Bestilling mottatt", en: "Order received" },
  review: { no: "Under behandling", en: "In review" },
  needsChange: { no: "Trenger endring", en: "Needs a change" },
  confirmed: { no: "Bekreftet", en: "Confirmed" },
  onTheWay: { no: "På vei", en: "On the way" },
  completed: { no: "Fullført", en: "Completed" },
  cancelled: { no: "Kansellert", en: "Cancelled" },
  notCompleted: { no: "Ikke gjennomført", en: "Not completed" },
};

// What the page says under the bar when the order needs a change or stopped.
export const PROGRESS_NOTES: Record<NonNullable<OrderProgress["note"]>, { no: string; en: string }> = {
  needsChange: {
    no: "Bestillingen trenger en endring før vi kan bekrefte den. Sjekk e-posten din, eller ta kontakt.",
    en: "The order needs a change before we can confirm it. Check your email, or contact us.",
  },
  cancelled: {
    no: "Bestillingen er kansellert.",
    en: "This order is cancelled.",
  },
  notCompleted: {
    no: "Oppdraget ble ikke gjennomført. Ta kontakt med oss hvis du har spørsmål.",
    en: "The job was not carried out. Contact us if you have questions.",
  },
};

const BADGE_CLASS: Record<OrderProgressStepKey, string> = {
  received: "bg-amber-50 text-amber-700",
  review: "bg-amber-50 text-amber-700",
  needsChange: "bg-orange-50 text-orange-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  onTheWay: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
  notCompleted: "bg-red-50 text-red-700",
};

// The status badge: the last step the order has reached (or stopped at).
export function progressBadge(progress: OrderProgress, locale: Locale): { label: string; className: string } {
  const step = [...progress.steps].reverse().find((s) => s.state !== "upcoming") ?? progress.steps[0];
  return { label: STEP_LABELS[step.key][locale], className: BADGE_CLASS[step.key] };
}

// "10. okt. 12:14" / "10 Oct 12:14", Oslo time.
export function formatStepTime(at: Date, locale: Locale): string {
  const tag = locale === "no" ? "nb-NO" : "en-GB";
  const date = at.toLocaleDateString(tag, { day: "numeric", month: "short", timeZone: "Europe/Oslo" });
  const time = at.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Oslo" }).replace(".", ":");
  return `${date} ${time}`;
}
