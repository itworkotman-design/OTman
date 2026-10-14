// Moving requests (app/api/site/moving-request/route.ts) have no dedicated
// columns for size/home type/floors/services — staff read them from Order.description,
// so they go there as plain lines above the customer's own notes.

export const MOVING_MAX_FLOORS = 4;

// `floors` is optional so a client that predates the floors stepper still
// submits fine; when sent it must be a whole number 1..MOVING_MAX_FLOORS.
export function parseMovingFloors(v: unknown): { ok: true; floors: number | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, floors: null };
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > MOVING_MAX_FLOORS) return { ok: false };
  return { ok: true, floors: v };
}

// What kind of home (or office) is being moved out of — asked on its own step so staff
// know roughly what to expect (stairwell/lift, shared parking, a house's
// garden shed, an office's furniture/IT…). Client-safe: MovingRequestFlow renders the tiles from this.
export const MOVING_HOME_TYPES = [
  { code: "APARTMENT", labelEn: "Apartment", labelNo: "Leilighet" },
  { code: "TOWNHOUSE", labelEn: "Townhouse", labelNo: "Rekkehus" },
  { code: "DETACHED", labelEn: "Detached house", labelNo: "Enebolig" },
  { code: "OFFICE", labelEn: "Office", labelNo: "Kontor" },
] as const;

export type MovingHomeType = (typeof MOVING_HOME_TYPES)[number];

// Optional on the server like `floors` (older clients), required in the flow.
export function parseMovingHomeType(v: unknown): { ok: true; homeType: MovingHomeType | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, homeType: null };
  const homeType = MOVING_HOME_TYPES.find((h) => h.code === v);
  return homeType ? { ok: true, homeType } : { ok: false };
}

export function movingOrderDescription(input: {
  sizeLabel: string;
  homeTypeLabel?: string | null;
  floors: number | null;
  serviceLabels: string[];
  notes: string | null;
}): string {
  return [
    `Approximate size: ${input.sizeLabel}`,
    input.homeTypeLabel ? `Property type: ${input.homeTypeLabel}` : null,
    input.floors ? `Floors: ${input.floors}` : null,
    input.serviceLabels.length > 0 ? `Additional services: ${input.serviceLabels.join(", ")}` : null,
    input.notes,
  ]
    .filter(Boolean)
    .join("\n\n");
}
