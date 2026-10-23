import { MOVING_MAX_FLOORS, type MovingHomeTypeCode } from "@/lib/orders/movingProperty";

// Pure geometry behind HouseIllustration.tsx: the house gets wider with the
// picked size bracket (lib/content/movingCatalog.ts codes) and taller with
// the floor count, inside a fixed viewBox so it grows upward from the ground.
// Drawn as a simple 3D (oblique) box: `depth` is how far the side wall and
// roof recede up-and-right from the front face.

export const HOUSE_MIN_FLOORS = 1;
export const HOUSE_MAX_FLOORS = MOVING_MAX_FLOORS;

const VIEWBOX_WIDTH = 250;
const VIEWBOX_HEIGHT = 230;
const GROUND_Y = 220;
const FLOOR_HEIGHT = 34;
// Roof rise is a share of the width (with a floor) so wide houses keep a pitch.
const ROOF_PITCH = 0.28;
const MIN_ROOF_HEIGHT = 30;
const ROOF_OVERHANG = 8;
const PARAPET_HEIGHT = 5;
const DEPTH = { dx: 36, dy: 20 };

const SIZE_SHAPES: Record<string, { width: number; windowsPerFloor: number }> = {
  SIZE_UNDER_20: { width: 90, windowsPerFloor: 1 },
  SIZE_UNDER_40: { width: 105, windowsPerFloor: 2 },
  SIZE_UNDER_60: { width: 120, windowsPerFloor: 2 },
  SIZE_UNDER_80: { width: 135, windowsPerFloor: 3 },
  SIZE_UNDER_100: { width: 150, windowsPerFloor: 3 },
  SIZE_UNDER_120: { width: 162, windowsPerFloor: 4 },
  SIZE_UNDER_140: { width: 176, windowsPerFloor: 4 },
  SIZE_OVER_140: { width: 190, windowsPerFloor: 5 },
  // Retired brackets, so older orders still draw at roughly their size.
  SIZE_UNDER_150: { width: 176, windowsPerFloor: 4 },
  SIZE_OVER_150: { width: 190, windowsPerFloor: 5 },
};
const DEFAULT_SHAPE = SIZE_SHAPES.SIZE_UNDER_60;

export function clampFloors(n: number): number {
  if (!Number.isFinite(n)) return HOUSE_MIN_FLOORS;
  return Math.min(HOUSE_MAX_FLOORS, Math.max(HOUSE_MIN_FLOORS, Math.round(n)));
}

export type HouseGeometry = {
  viewBoxWidth: number;
  viewBoxHeight: number;
  groundY: number;
  x: number;
  width: number;
  floorHeight: number;
  depth: { dx: number; dy: number };
  windowsPerFloor: number;
  // Index 0 is the ground floor.
  floors: { y: number; height: number }[];
  // Which building to draw — the floor stack is the same for all of them.
  variant: HouseVariant;
  roof: { style: "gable" | "flat"; leftX: number; rightX: number; baseY: number; peakY: number };
  // Apartment/office once its floor is known: the unit drawn inside the rest
  // of its building (replaces `floors` + `roof`), otherwise null.
  building: SurroundingBuilding | null;
};

export type BuildingLevel = {
  // As the customer counts them: 1 = ground floor, negative = basement (no 0).
  floorNumber: number;
  y: number;
  height: number;
  // One of the customer's own floors (the rest are neighbours).
  isUnit: boolean;
  isGround: boolean;
  isBasement: boolean;
};

export type SurroundingBuilding = {
  // Bottom-up; only the levels that fall inside the viewBox.
  levels: BuildingLevel[];
  // Where the ground line ended up after scrolling the unit into view — may
  // be outside the viewBox.
  groundY: number;
  // The building carries on past the bottom edge (unit high up, or a
  // basement), so the drawing fades out there. The top always fades.
  fadeBottom: boolean;
};

export type HouseVariant = "house" | "townhouse" | "apartment" | "office";

const VARIANTS: Record<MovingHomeTypeCode, HouseVariant> = {
  DETACHED: "house",
  TOWNHOUSE: "townhouse",
  APARTMENT: "apartment",
  OFFICE: "office",
};

// 1 → 0 (ground), 2 → 1, …; basements stay negative (-1 → -1).
function floorLevel(floorNumber: number): number {
  return floorNumber >= 1 ? floorNumber - 1 : floorNumber;
}

function levelFloorNumber(level: number): number {
  return level >= 0 ? level + 1 : level;
}

// The unit (`unitFloors` stacked floors from `floorNumber` up) with just
// enough of its building around it to fill the viewBox: neighbouring floors
// above up past the top edge, and below either down to the ground or past
// the bottom edge. A unit near the ground keeps the ground where a house's
// would be; a higher one (or a basement) is scrolled to the middle instead.
function surroundingBuilding(floorNumber: number, unitFloors: number): SurroundingBuilding {
  const unitBottom = floorLevel(Math.round(floorNumber));
  const unitTop = unitBottom + unitFloors - 1;
  const levelTop = (level: number, ground: number) => ground - FLOOR_HEIGHT * (level + 1);

  // Centre the unit a little below the middle, leaving room for the side
  // wall that recedes upward.
  const target = (VIEWBOX_HEIGHT + DEPTH.dy) / 2;
  // Half the unit's height up from the bottom of its lowest floor.
  const unitCentre = GROUND_Y - FLOOR_HEIGHT * (unitBottom + unitFloors / 2);
  const shift = unitBottom >= 0 ? Math.max(0, target - unitCentre) : target - unitCentre;
  const groundY = GROUND_Y + shift;

  // Lowest level still inside the box, but never below the unit's own
  // basement level (nothing to show underneath it).
  const firstVisible = Math.floor((groundY - VIEWBOX_HEIGHT) / FLOOR_HEIGHT);
  const lowest = Math.max(firstVisible, Math.min(0, unitBottom));
  // Highest level whose side wall still reaches into the box.
  const highest = Math.max(unitTop, Math.ceil((groundY + DEPTH.dy) / FLOOR_HEIGHT) - 1);

  const levels: BuildingLevel[] = [];
  for (let level = lowest; level <= highest; level++) {
    levels.push({
      floorNumber: levelFloorNumber(level),
      y: levelTop(level, groundY),
      height: FLOOR_HEIGHT,
      isUnit: level >= unitBottom && level <= unitTop,
      isGround: level === 0,
      isBasement: level < 0,
    });
  }

  return { levels, groundY, fadeBottom: groundY > GROUND_Y };
}

export function houseGeometry(
  sizeCode: string | null,
  floorCount: number,
  homeType: MovingHomeTypeCode | null = null,
  // Which floor an apartment/office is on (MovingPropertyDraft.floorNumber);
  // ignored for houses and townhouses.
  floorNumber: number | null = null,
): HouseGeometry {
  const variant = homeType ? VARIANTS[homeType] : "house";
  const flat = variant === "apartment" || variant === "office";
  const shape = (sizeCode && SIZE_SHAPES[sizeCode]) || DEFAULT_SHAPE;
  const count = clampFloors(floorCount);
  // Centre front + side together, not just the front face — except a
  // townhouse, whose side wall is hidden behind the attached neighbour.
  const x = (VIEWBOX_WIDTH - shape.width - (variant === "townhouse" ? 0 : DEPTH.dx)) / 2;

  const floors = Array.from({ length: count }, (_, i) => ({
    y: GROUND_Y - FLOOR_HEIGHT * (i + 1),
    height: FLOOR_HEIGHT,
  }));
  const baseY = GROUND_Y - FLOOR_HEIGHT * count;

  return {
    viewBoxWidth: VIEWBOX_WIDTH,
    viewBoxHeight: VIEWBOX_HEIGHT,
    groundY: GROUND_Y,
    x,
    width: shape.width,
    floorHeight: FLOOR_HEIGHT,
    depth: DEPTH,
    windowsPerFloor: shape.windowsPerFloor,
    floors,
    variant,
    roof: {
      style: flat ? "flat" : "gable",
      leftX: x - ROOF_OVERHANG,
      rightX: x + shape.width + ROOF_OVERHANG,
      baseY,
      peakY: baseY - (flat ? PARAPET_HEIGHT : Math.max(MIN_ROOF_HEIGHT, shape.width * ROOF_PITCH)),
    },
    // While the floor box is empty (or mid-edit), shown on the ground floor.
    building: flat
      ? surroundingBuilding(
          floorNumber != null && Number.isFinite(floorNumber) && Math.round(floorNumber) !== 0 ? floorNumber : 1,
          count,
        )
      : null,
  };
}
