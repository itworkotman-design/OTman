import type { AdjustmentLine } from "@/lib/booking/pricing/adjustmentLines";

// Amount field filter: digits plus a single decimal separator (the first
// "," or "." typed is kept as typed) with at most 2 decimals. Everything
// else — letters, spaces, minus signs — is dropped.
export function sanitizeAmountInput(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, "");
  const separatorIndex = cleaned.search(/[.,]/);
  if (separatorIndex === -1) return cleaned;

  const whole = cleaned.slice(0, separatorIndex) || "0";
  const decimals = cleaned.slice(separatorIndex + 1).replace(/[.,]/g, "").slice(0, 2);
  return `${whole}${cleaned[separatorIndex]}${decimals}`;
}

// Calculator UI state: which adjustment lines are open as drafts (inputs +
// Apply) vs. shown as applied rows. Lines appearing for the first time are
// opened only when freshly added (amount 0); lines loaded from a saved order
// and linked partner minus lines (which follow their discount) are not.
// Returns null when nothing changed, so callers can skip a state update.
export function trackNewAdjustmentLines(
  lines: AdjustmentLine[],
  knownIds: Set<string>,
  editingIds: Set<string>,
): { knownIds: Set<string>; editingIds: Set<string> } | null {
  const added = lines.filter((line) => !knownIds.has(line.id));
  if (added.length === 0) return null;

  const nextKnown = new Set(knownIds);
  const nextEditing = new Set(editingIds);
  for (const line of added) {
    nextKnown.add(line.id);
    if (line.amount === 0 && !line.sourceId) nextEditing.add(line.id);
  }
  return { knownIds: nextKnown, editingIds: nextEditing };
}
