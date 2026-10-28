// Labour products are billed in 15-minute increments.
export const HOURS_INPUT_STEP = 0.25;

export function normalizeHoursInput(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  const snapped = Math.round(value / HOURS_INPUT_STEP) * HOURS_INPUT_STEP;
  return Math.max(HOURS_INPUT_STEP, snapped);
}

// Keeps only digits and the first decimal separator ("." or ",").
export function sanitizeHoursInputDraft(text: string): string {
  const cleaned = text.replace(/[^\d.,]/g, "");
  const sepIndex = cleaned.search(/[.,]/);
  if (sepIndex === -1) return cleaned;
  return cleaned.slice(0, sepIndex + 1) + cleaned.slice(sepIndex + 1).replace(/[.,]/g, "");
}

// Parses what the user is typing ("1,5" / "1.5"); null while empty or invalid.
export function parseHoursInputDraft(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
