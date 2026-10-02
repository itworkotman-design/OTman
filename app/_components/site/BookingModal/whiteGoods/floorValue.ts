// Floors in the booking flow count from 1 (the ground floor, Norwegian
// "1. etasje"), and go negative below ground (-1 is the first basement) —
// there is no floor 0. null means not chosen yet, which keeps the (required)
// field empty instead of pre-filling an answer.

const MAX_FLOOR_DIGITS = 3;

// What the floor box may contain while typing: digits with one optional
// leading minus (a lone "-" is allowed mid-typing). Anything else is dropped,
// as are leading zeros, since 0 isn't a floor.
export function sanitizeFloorText(text: string): string {
  const sign = text.trimStart().startsWith("-") ? "-" : "";
  const digits = text.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_FLOOR_DIGITS);
  return sign + digits;
}

// What the floor box's text means: a whole, non-zero floor, or null for an
// empty box, a lone minus, 0, or anything else that isn't a floor.
export function parseFloorInput(text: string): number | null {
  if (!/^-?\d+$/.test(text.trim())) return null;
  const floor = Number(text);
  return floor === 0 ? null : floor;
}

// One step of the up/down stepper. From nothing chosen, either direction
// lands on the ground floor; stepping skips over 0 (1 ↔ -1).
export function stepFloor(current: number | null, direction: 1 | -1): number {
  if (current === null) return 1;
  const next = current + direction;
  return next === 0 ? next + direction : next;
}
