// Moving requests (app/api/site/moving-request/route.ts) have no dedicated
// columns for size/floors — staff read them from Order.description, so both
// go there as plain lines above the customer's own notes.

export const MOVING_MAX_FLOORS = 4;

// `floors` is optional so a client that predates the floors stepper still
// submits fine; when sent it must be a whole number 1..MOVING_MAX_FLOORS.
export function parseMovingFloors(v: unknown): { ok: true; floors: number | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, floors: null };
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > MOVING_MAX_FLOORS) return { ok: false };
  return { ok: true, floors: v };
}

export function movingOrderDescription(input: {
  sizeLabel: string;
  floors: number | null;
  notes: string | null;
}): string {
  return [
    `Approximate size: ${input.sizeLabel}`,
    input.floors ? `Floors: ${input.floors}` : null,
    input.notes,
  ]
    .filter(Boolean)
    .join("\n\n");
}
