// One end of a move — the place being moved out of (origin) or into
// (destination): what kind of property it is, roughly how big, how many
// floors, whether there's a lift, and how close the van can park. The flow
// (MovingRequestFlow) asks the same questions for both ends; the route
// (app/api/site/moving-request) validates both with the same parser, so the
// client's "can continue" check and the server's 422 can't disagree.
// Client-safe — no database import.

import { getChargeableFloors } from "@/lib/booking/pricing/buildWhiteGoodsCalculatorBreakdowns";

export const MOVING_MAX_FLOORS = 4;
// Same 3-digit limit as the delivery modal's floor box (floorValue.ts).
const MOVING_MAX_FLOOR_NUMBER = 999;

export const MOVING_HOME_TYPES = [
  { code: "APARTMENT", labelEn: "Apartment", labelNo: "Leilighet" },
  { code: "TOWNHOUSE", labelEn: "Townhouse", labelNo: "Rekkehus" },
  { code: "DETACHED", labelEn: "Detached house", labelNo: "Enebolig" },
  { code: "OFFICE", labelEn: "Office", labelNo: "Kontor" },
] as const;

export type MovingHomeType = (typeof MOVING_HOME_TYPES)[number];
export type MovingHomeTypeCode = MovingHomeType["code"];

// Carrying distance from the van to the door — what actually changes the job.
export const MOVING_PARKING_OPTIONS = [
  { code: "OUTSIDE", labelEn: "Right outside", labelNo: "Rett utenfor" },
  { code: "WITHIN_50M", labelEn: "Within 50 m", labelNo: "Innen 50 m" },
  { code: "FURTHER", labelEn: "Further away", labelNo: "Lenger unna" },
] as const;

export type MovingParkingOption = (typeof MOVING_PARKING_OPTIONS)[number];
export type MovingParkingCode = MovingParkingOption["code"];

// Houses and townhouses basically never have a lift, so the question is only
// asked (and only stored) for apartments and offices.
export function movingLiftApplies(homeType: MovingHomeTypeCode | null): boolean {
  return homeType === "APARTMENT" || homeType === "OFFICE";
}

// What the flow edits for each end before it's complete.
export type MovingPropertyDraft = {
  homeType: MovingHomeTypeCode | null;
  sizeOptionCode: string | null;
  floors: number;
  hasLift: boolean | null;
  // Which floor the apartment/office is on — only asked (and required) when
  // there is no lift, since that is what costs extra (movingChargeableFloors).
  // Counts like the delivery modal: 1 = ground floor, -1 = first basement.
  floorNumber: number | null;
  parking: MovingParkingCode | null;
};

export function emptyMovingProperty(): MovingPropertyDraft {
  return { homeType: null, sizeOptionCode: null, floors: 1, hasLift: null, floorNumber: null, parking: null };
}

export type MovingProperty = {
  homeType: MovingHomeType;
  // Checked against the catalog by the route, not here (the parser has no DB).
  sizeOptionCode: string;
  floors: number;
  // null when the lift question doesn't apply (movingLiftApplies).
  hasLift: boolean | null;
  // null unless there is no lift (see MovingPropertyDraft.floorNumber).
  floorNumber: number | null;
  parking: MovingParkingOption;
};

export function parseMovingProperty(
  v: unknown,
): { ok: true; property: MovingProperty } | { ok: false; errors: Record<string, string> } {
  const input = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const homeType = MOVING_HOME_TYPES.find((h) => h.code === input.homeType);
  if (!homeType) errors.homeType = input.homeType == null ? "Required" : "Invalid";

  const sizeOptionCode = typeof input.sizeOptionCode === "string" ? input.sizeOptionCode.trim() : "";
  if (!sizeOptionCode) errors.sizeOptionCode = "Required";

  const floors = input.floors;
  const floorsOk = typeof floors === "number" && Number.isInteger(floors) && floors >= 1 && floors <= MOVING_MAX_FLOORS;
  if (!floorsOk) errors.floors = floors == null ? "Required" : "Invalid";

  const liftApplies = movingLiftApplies(homeType?.code ?? null);
  if (liftApplies && typeof input.hasLift !== "boolean") errors.hasLift = "Required";

  const floorAsked = liftApplies && input.hasLift === false;
  const floorNumber = input.floorNumber;
  if (floorAsked) {
    const floorOk =
      typeof floorNumber === "number" &&
      Number.isInteger(floorNumber) &&
      floorNumber !== 0 &&
      Math.abs(floorNumber) <= MOVING_MAX_FLOOR_NUMBER;
    if (!floorOk) errors.floorNumber = floorNumber == null ? "Required" : "Invalid";
  }

  const parking = MOVING_PARKING_OPTIONS.find((p) => p.code === input.parking);
  if (!parking) errors.parking = input.parking == null ? "Required" : "Invalid";

  if (!homeType || !floorsOk || !parking || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    property: {
      homeType,
      sizeOptionCode,
      floors: floors as number,
      hasLift: liftApplies ? (input.hasLift as boolean) : null,
      floorNumber: floorAsked ? (floorNumber as number) : null,
      parking,
    },
  };
}

// One line for staff in Order.description, e.g.
// "Apartment, Under 40 m², 1 floor, lift: yes, parking: within 50 m".
export function movingPropertyLine(property: MovingProperty, sizeLabel: string): string {
  return [
    property.homeType.labelEn,
    sizeLabel,
    `${property.floors} ${property.floors === 1 ? "floor" : "floors"}`,
    property.hasLift === null
      ? null
      : `lift: ${property.hasLift ? "yes" : "no"}${property.floorNumber === null ? "" : ` (on floor ${property.floorNumber})`}`,
    `parking: ${property.parking.labelEn.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(", ");
}

// Whether one end of the move is fully answered, so the flow can open the
// next section. A free-typed address that was never picked from the
// suggestions doesn't count — same rule as the delivery modal
// (isOrderDetailsStepReady, AddressAutocompleteInput's `wasSelected`).
export function isMovingEndReady(params: {
  address: string;
  addressSelected: boolean;
  property: MovingPropertyDraft;
}): boolean {
  return params.address.trim().length > 0 && params.addressSelected && parseMovingProperty(params.property).ok;
}

// Floors that cost extra at this end: the delivery modal's rule
// (getChargeableFloors) — free up to the 2nd floor and down to the 1st
// basement, then per floor — only ever with no lift.
export function movingChargeableFloors(property: Pick<MovingProperty, "hasLift" | "floorNumber">): number {
  if (property.hasLift !== false || property.floorNumber === null) return 0;
  return getChargeableFloors(property.floorNumber, false);
}
