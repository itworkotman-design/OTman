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
  SIZE_UNDER_40: { width: 110, windowsPerFloor: 2 },
  SIZE_UNDER_60: { width: 130, windowsPerFloor: 2 },
  SIZE_UNDER_100: { width: 155, windowsPerFloor: 3 },
  SIZE_OVER_100: { width: 180, windowsPerFloor: 4 },
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
};

export type HouseVariant = "house" | "townhouse" | "apartment" | "office";

const VARIANTS: Record<MovingHomeTypeCode, HouseVariant> = {
  DETACHED: "house",
  TOWNHOUSE: "townhouse",
  APARTMENT: "apartment",
  OFFICE: "office",
};

export function houseGeometry(
  sizeCode: string | null,
  floorCount: number,
  homeType: MovingHomeTypeCode | null = null,
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
  };
}
