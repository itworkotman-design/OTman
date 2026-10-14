import { useId } from "react";
import type { MovingHomeTypeCode } from "@/lib/orders/movingProperty";
import { houseGeometry, type HouseGeometry } from "./houseGeometry";

type Props = {
  sizeCode: string | null;
  floors: number;
  homeType?: MovingHomeTypeCode | null;
  // Apartment/office: which floor it's on (1 = ground, negative = basement).
  floorNumber?: number | null;
  className?: string;
};

const WINDOW = 14;
const DOOR_WIDTH = 16;
const DOOR_HEIGHT = 24;
const MOTION = "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)";
// Solid shades of --logoblue (#273097) so overlapping faces don't show through.
const FRONT = "#ffffff";
const SIDE = "#dcdff2";
const ROOF_TOP = "#c3c7ea";
const ROOF_LIGHT = "#273097";
const ROOF_DARK = "#1b2270";
const GLASS = "#c9cdec";
const STROKE = "#273097";
// Neighbours (Rekkehus) are washed out towards the panel background with a
// colour filter rather than opacity, so they stay solid and actually hide
// this unit's side wall instead of letting it show through.
const NEIGHBOUR_WASH = 0.35;
const NEIGHBOUR_MATRIX = [
  [NEIGHBOUR_WASH, 0, 0, 0, (1 - NEIGHBOUR_WASH) * 0.953],
  [0, NEIGHBOUR_WASH, 0, 0, (1 - NEIGHBOUR_WASH) * 0.957],
  [0, 0, NEIGHBOUR_WASH, 0, (1 - NEIGHBOUR_WASH) * 0.984],
  [0, 0, 0, 1, 0],
]
  .flat()
  .join(" ");

type Point = [number, number];

function windowXs(fromX: number, toX: number, count: number): number[] {
  const step = (toX - fromX) / (count + 1);
  return Array.from({ length: count }, (_, i) => fromX + step * (i + 1) - WINDOW / 2);
}

function pts(...points: Point[]): string {
  return points.map(([px, py]) => `${px},${py}`).join(" ");
}

function Window({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={WINDOW} height={WINDOW} rx={1.5} fill={GLASS} stroke={STROKE} strokeWidth={1.25} />
      <line x1={x + WINDOW / 2} x2={x + WINDOW / 2} y1={y} y2={y + WINDOW} stroke={STROKE} strokeWidth={0.75} />
      <line x1={x} x2={x + WINDOW} y1={y + WINDOW / 2} y2={y + WINDOW / 2} stroke={STROKE} strokeWidth={0.75} />
    </g>
  );
}

// A band of glass across the facade, split by mullions — the office look.
function GlassRibbon({ x0, x1, y, height }: { x0: number; x1: number; y: number; height: number }) {
  if (x1 - x0 < 8) return null;
  const panes = Math.max(1, Math.round((x1 - x0) / 16));
  const pane = (x1 - x0) / panes;
  return (
    <g>
      <rect x={x0} y={y} width={x1 - x0} height={height} fill={GLASS} stroke={STROKE} strokeWidth={1.25} />
      {Array.from({ length: panes - 1 }, (_, i) => (
        <line key={i} x1={x0 + pane * (i + 1)} x2={x0 + pane * (i + 1)} y1={y} y2={y + height} stroke={STROKE} strokeWidth={0.75} />
      ))}
    </g>
  );
}

function Door({ x, groundY }: { x: number; groundY: number }) {
  return (
    <>
      <rect x={x} y={groundY - DOOR_HEIGHT} width={DOOR_WIDTH} height={DOOR_HEIGHT} rx={1.5} fill={STROKE} />
      <circle cx={x + DOOR_WIDTH - 4} cy={groundY - DOOR_HEIGHT / 2} r={1.2} fill={FRONT} />
    </>
  );
}

// Everything on one floor's front face, per building type.
function Facade({ g, top, height, isGround }: { g: HouseGeometry; top: number; height: number; isGround: boolean }) {
  const right = g.x + g.width;
  const centreX = g.x + g.width / 2;
  const windowY = top + (height - WINDOW) / 2 - (isGround ? 2 : 0);

  if (g.variant === "office") {
    const ribbonY = top + 8;
    const ribbonH = height - 16;
    if (!isGround) return <GlassRibbon x0={g.x + 6} x1={right - 6} y={ribbonY} height={ribbonH} />;
    // Glass double doors in the middle, glass on either side.
    const doorsX = centreX - 11;
    return (
      <>
        <GlassRibbon x0={g.x + 6} x1={doorsX - 5} y={ribbonY} height={ribbonH} />
        <GlassRibbon x0={doorsX + 27} x1={right - 6} y={ribbonY} height={ribbonH} />
        <rect x={doorsX} y={g.groundY - DOOR_HEIGHT - 2} width={22} height={DOOR_HEIGHT + 2} fill={GLASS} stroke={STROKE} strokeWidth={1.25} />
        <line x1={centreX} x2={centreX} y1={g.groundY - DOOR_HEIGHT - 2} y2={g.groundY} stroke={STROKE} strokeWidth={1.25} />
      </>
    );
  }

  if (g.variant === "apartment") {
    const count = g.windowsPerFloor + 1;
    if (!isGround) {
      // Every upper-floor window gets a balcony.
      return (
        <>
          {windowXs(g.x, right, count).map((wx) => (
            <g key={wx}>
              <Window x={wx} y={windowY - 2} />
              <rect x={wx - 3} y={windowY + WINDOW - 4} width={WINDOW + 6} height={7} fill={SIDE} stroke={STROKE} strokeWidth={1.25} />
            </g>
          ))}
        </>
      );
    }
    // Shared entrance in the middle, under a small canopy.
    const doorX = centreX - DOOR_WIDTH / 2;
    const side = Math.max(1, Math.floor(count / 2));
    return (
      <>
        {[...windowXs(g.x, doorX - 4, side), ...windowXs(doorX + DOOR_WIDTH + 4, right, side)].map((wx) => (
          <Window key={wx} x={wx} y={windowY} />
        ))}
        <Door x={doorX} groundY={g.groundY} />
        <rect x={doorX - 5} y={g.groundY - DOOR_HEIGHT - 5} width={DOOR_WIDTH + 10} height={4} rx={1} fill={ROOF_LIGHT} />
      </>
    );
  }

  // House / townhouse: door on the left of the ground floor.
  const xs = isGround
    ? windowXs(g.x + 12 + DOOR_WIDTH, right, Math.max(1, g.windowsPerFloor - 1))
    : windowXs(g.x, right, g.windowsPerFloor);
  return (
    <>
      {xs.map((wx) => (
        <Window key={wx} x={wx} y={windowY} />
      ))}
      {isGround && <Door x={g.x + 12} groundY={g.groundY} />}
    </>
  );
}

// The skewed window (or glass band, for an office) on the side wall.
function SideWindow({ g, top, height }: { g: HouseGeometry; top: number; height: number }) {
  const { dx, dy } = g.depth;
  const right = g.x + g.width;
  const office = g.variant === "office";
  const [t0, t1] = office ? [0.12, 0.88] : [0.32, 0.68];
  const y = office ? top + 8 : top + (height - WINDOW) / 2;
  const h = office ? height - 16 : WINDOW;
  const a: Point = [right + dx * t0, y - dy * t0];
  const b: Point = [right + dx * t1, y - dy * t1];
  return (
    <polygon
      points={pts(a, b, [b[0], b[1] + h], [a[0], a[1] + h])}
      fill={GLASS}
      stroke={STROKE}
      strokeWidth={1.25}
      strokeLinejoin="round"
    />
  );
}

function GableRoof({ g }: { g: HouseGeometry }) {
  const { roof } = g;
  const { dx, dy } = g.depth;
  const right = g.x + g.width;
  const peakX = g.x + g.width / 2;
  const rise = roof.baseY - roof.peakY;
  // Eaves drop a little below the wall top and the ridge sits a little above
  // the gable peak, giving the roof a visible thickness.
  const eaveY = 4;
  const ridgeY = -rise - 3;
  const ridgeFront: Point = [peakX, ridgeY];
  const ridgeBack: Point = [peakX + dx, ridgeY - dy];
  // Chimney on the right roof plane, halfway down the slope and halfway back.
  const chimneyT = 0.45;
  const cx = peakX + (roof.rightX - peakX) * chimneyT + dx * 0.5;
  const cy = ridgeY + (eaveY - ridgeY) * chimneyT - dy * 0.5;

  return (
    <>
      <polygon points={pts([roof.leftX, eaveY], ridgeFront, ridgeBack, [roof.leftX + dx, eaveY - dy])} fill={ROOF_DARK} stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
      <polygon points={pts(ridgeFront, [roof.rightX, eaveY], [roof.rightX + dx, eaveY - dy], ridgeBack)} fill={ROOF_LIGHT} stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
      <polygon points={pts([cx, cy + 4], [cx, cy - 16], [cx + 9, cy - 16], [cx + 9, cy + 2])} fill={SIDE} stroke={STROKE} strokeWidth={1.25} strokeLinejoin="round" />
      <polygon points={pts([cx, cy - 16], [cx + 5, cy - 19], [cx + 14, cy - 19], [cx + 9, cy - 16])} fill={ROOF_DARK} stroke={STROKE} strokeWidth={1.25} strokeLinejoin="round" />
      <polygon points={pts([g.x, 0], [peakX, -rise], [right, 0])} fill={FRONT} stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={peakX} cy={-rise * 0.42} r={5} fill={GLASS} stroke={STROKE} strokeWidth={1.25} />
    </>
  );
}

// Flat roof seen from above: the roof surface, a box on it (stair/lift
// housing on an apartment block, a ventilation unit on an office), and a low
// parapet around the edge.
function FlatRoof({ g }: { g: HouseGeometry }) {
  const { dx, dy } = g.depth;
  const right = g.x + g.width;
  const p = -(g.roof.baseY - g.roof.peakY);
  const office = g.variant === "office";
  const boxW = office ? 22 : 16;
  const boxH = office ? 8 : 13;
  const boxD = 8;
  const bx = g.x + g.width * (office ? 0.5 : 0.58) + dx * 0.35;
  const by = p - dy * 0.35;

  return (
    <>
      <polygon points={pts([g.x, p], [right, p], [right + dx, p - dy], [g.x + dx, p - dy])} fill={ROOF_TOP} stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
      <polygon points={pts([bx + boxW, by], [bx + boxW + boxD, by - boxD * 0.55], [bx + boxW + boxD, by - boxD * 0.55 - boxH], [bx + boxW, by - boxH])} fill={SIDE} stroke={STROKE} strokeWidth={1.25} strokeLinejoin="round" />
      <polygon points={pts([bx, by - boxH], [bx + boxW, by - boxH], [bx + boxW + boxD, by - boxD * 0.55 - boxH], [bx + boxD, by - boxD * 0.55 - boxH])} fill={ROOF_LIGHT} stroke={STROKE} strokeWidth={1.25} strokeLinejoin="round" />
      <rect x={bx} y={by - boxH} width={boxW} height={boxH} fill={FRONT} stroke={STROKE} strokeWidth={1.25} />
      {office &&
        [5, 11, 17].map((lx) => (
          <line key={lx} x1={bx + lx} x2={bx + lx} y1={by - boxH + 2} y2={by - 2} stroke={STROKE} strokeWidth={0.75} />
        ))}
      <polygon points={pts([right, p], [right + dx, p - dy], [right + dx, -dy], [right, 0])} fill={SIDE} stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
      <rect x={g.x} y={p} width={g.width} height={-p} fill={FRONT} stroke={STROKE} strokeWidth={1.5} />
    </>
  );
}

// One story: side wall, front face and its windows/doors. A basement gets
// just a row of small windows.
function Floor({ g, top, height, isGround, isBasement = false }: { g: HouseGeometry; top: number; height: number; isGround: boolean; isBasement?: boolean }) {
  const { dx, dy } = g.depth;
  const right = g.x + g.width;
  const bottom = top + height;
  return (
    <>
      <polygon
        points={pts([right, top], [right + dx, top - dy], [right + dx, bottom - dy], [right, bottom])}
        fill={SIDE}
        stroke={STROKE}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {!isBasement && <SideWindow g={g} top={top} height={height} />}
      <rect x={g.x} y={top} width={g.width} height={height} fill={FRONT} stroke={STROKE} strokeWidth={1.5} />
      {isBasement ? (
        windowXs(g.x, right, g.windowsPerFloor).map((wx) => <Window key={wx} x={wx} y={top + 5} />)
      ) : (
        <Facade g={g} top={top} height={height} isGround={isGround} />
      )}
    </>
  );
}

// One building: the floor stack plus its roof.
function Building({ g }: { g: HouseGeometry }) {
  return (
    <>
      {g.floors.map((floor, i) => (
        <g key={i} className="house-floor">
          <Floor g={g} top={floor.y} height={floor.height} isGround={i === 0} />
        </g>
      ))}

      {/* Moved as one piece onto the top floor so the move animates instead of snapping. */}
      <g className="house-roof" style={{ transform: `translateY(${g.roof.baseY}px)`, transition: MOTION }}>
        {g.roof.style === "flat" ? <FlatRoof g={g} /> : <GableRoof g={g} />}
      </g>
    </>
  );
}

// Apartment/office on a known floor: the unit's own floors in full colour,
// the neighbouring floors of the block washed out around it, running off the
// top of the box (and off the bottom when the ground isn't in view) behind a
// fade. Basements sit below the ground line, in front of a band of soil.
function SurroundingBuilding({ g: house, washId, idBase }: { g: HouseGeometry; washId: string; idBase: string }) {
  const b = house.building!;
  // The ground moves when the unit is scrolled into view; the entrance doors follow it.
  const g = { ...house, groundY: b.groundY };
  const { dx, dy } = g.depth;
  const fadeId = `${idBase}-fade`;
  const maskId = `${idBase}-mask`;
  const h = g.viewBoxHeight;

  return (
    <>
      <defs>
        <linearGradient id={fadeId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={h}>
          <stop offset={0} stopColor="#fff" stopOpacity={0} />
          <stop offset={0.2} stopColor="#fff" stopOpacity={1} />
          <stop offset={b.fadeBottom ? 0.82 : 1} stopColor="#fff" stopOpacity={1} />
          <stop offset={1} stopColor="#fff" stopOpacity={b.fadeBottom ? 0 : 1} />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={-dy} width={g.viewBoxWidth} height={h + dy}>
          <rect x={0} y={-dy} width={g.viewBoxWidth} height={h + dy} fill={`url(#${fadeId})`} />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`}>
        {b.groundY < h && (
          <>
            {b.levels[0].isBasement && (
              <rect x={0} y={b.groundY - dy / 2} width={g.viewBoxWidth} height={h} fill={STROKE} opacity={0.06} />
            )}
            <ellipse cx={g.x + (g.width + dx) / 2} cy={b.groundY - dy / 2} rx={(g.width + dx) / 2 + 14} ry={dy / 2 + 7} fill={STROKE} opacity={0.1} />
          </>
        )}
        {b.levels.map((level, i) =>
          level.isUnit ? (
            // Keyed by floor so a newly added unit floor pops in like a house's.
            <g key={`unit-${level.floorNumber}`} className="house-floor">
              <Floor g={g} top={level.y} height={level.height} isGround={level.isGround} isBasement={level.isBasement} />
            </g>
          ) : (
            <g key={`n-${i}`} filter={`url(#${washId})`}>
              <Floor g={g} top={level.y} height={level.height} isGround={level.isGround} isBasement={level.isBasement} />
            </g>
          ),
        )}
      </g>
    </>
  );
}

// Decorative preview next to the moving flow's size tiles — wider for a
// bigger size bracket, one stacked floor per story, styled by property type
// (detached house, townhouse with its neighbours, apartment block, office),
// drawn in 3D. Floors pop in from above and the roof slides up to sit on the
// new top floor. Once an apartment/office's floor is known, it's shown
// inside the rest of its block instead (SurroundingBuilding).
export function HouseIllustration({ sizeCode, floors, homeType = null, floorNumber = null, className }: Props) {
  const g = houseGeometry(sizeCode, floors, homeType, floorNumber);
  const { dx, dy } = g.depth;
  const townhouse = g.variant === "townhouse";
  const idBase = `house-${useId().replace(/:/g, "")}`;
  const washId = `${idBase}-wash`;

  return (
    <svg viewBox={`0 0 ${g.viewBoxWidth} ${g.viewBoxHeight}`} className={className} aria-hidden="true">
      <style>{`
        @keyframes house-floor-in { from { opacity: 0; transform: translateY(-14px); } }
        .house-floor { animation: house-floor-in 300ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .house-floor { animation: none; } .house-roof { transition: none !important; } }
      `}</style>
      <defs>
        <filter id={washId} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={NEIGHBOUR_MATRIX} />
        </filter>
      </defs>

      {g.building ? (
        <SurroundingBuilding g={g} washId={washId} idBase={idBase} />
      ) : (
        <ellipse
          cx={g.x + (g.width + dx) / 2}
          cy={g.groundY - dy / 2}
          rx={townhouse ? g.viewBoxWidth / 2 : (g.width + dx) / 2 + 14}
          ry={dy / 2 + 7}
          fill={STROKE}
          opacity={0.1}
        />
      )}

      {/* Rekkehus: faded neighbouring units on both sides. The right one is
          drawn last so it hides this unit's side wall — they're attached. */}
      {townhouse && (
        <g transform={`translate(${-g.width} 0)`} filter={`url(#${washId})`}>
          <Building g={g} />
        </g>
      )}
      {!g.building && <Building g={g} />}
      {townhouse && (
        <g transform={`translate(${g.width} 0)`} filter={`url(#${washId})`}>
          <Building g={g} />
        </g>
      )}
    </svg>
  );
}
