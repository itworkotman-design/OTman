import { houseGeometry } from "./houseGeometry";

type Props = {
  sizeCode: string | null;
  floors: number;
  className?: string;
};

const WINDOW = 14;
const DOOR_WIDTH = 16;
const DOOR_HEIGHT = 24;
const MOTION = "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)";
// Solid shades of --logoblue (#273097) so overlapping faces don't show through.
const FRONT = "#ffffff";
const SIDE = "#dcdff2";
const ROOF_LIGHT = "#273097";
const ROOF_DARK = "#1b2270";
const GLASS = "#c9cdec";
const STROKE = "#273097";

function windowXs(fromX: number, toX: number, count: number): number[] {
  const step = (toX - fromX) / (count + 1);
  return Array.from({ length: count }, (_, i) => fromX + step * (i + 1) - WINDOW / 2);
}

function pts(...points: [number, number][]): string {
  return points.map(([px, py]) => `${px},${py}`).join(" ");
}

// Decorative preview next to the moving flow's size tiles — wider for a
// bigger size bracket, one stacked floor per story, drawn as a 3D box with a
// gable roof. Floors pop in from above and the roof slides up to sit on the
// new top floor.
export function HouseIllustration({ sizeCode, floors, className }: Props) {
  const g = houseGeometry(sizeCode, floors);
  const { roof, depth } = g;
  const { dx, dy } = depth;
  const right = g.x + g.width;
  const peakX = g.x + g.width / 2;
  const rise = roof.baseY - roof.peakY;

  // Roof coordinates are relative to the roof base (y = 0) so the whole roof
  // can be moved by one animated transform. Eaves drop a little below the
  // wall top and the ridge sits a little above the gable peak, giving the
  // roof a visible thickness.
  const eaveY = 4;
  const ridgeY = -rise - 3;
  const ridgeFront: [number, number] = [peakX, ridgeY];
  const ridgeBack: [number, number] = [peakX + dx, ridgeY - dy];

  // Chimney on the right roof plane, halfway down the slope and halfway back.
  const chimneyT = 0.45;
  const chimneyBaseX = peakX + (roof.rightX - peakX) * chimneyT + dx * 0.5;
  const chimneyBaseY = ridgeY + (eaveY - ridgeY) * chimneyT - dy * 0.5;

  return (
    <svg viewBox={`0 0 ${g.viewBoxWidth} ${g.viewBoxHeight}`} className={className} aria-hidden="true">
      <style>{`
        @keyframes house-floor-in { from { opacity: 0; transform: translateY(-14px); } }
        .house-floor { animation: house-floor-in 300ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .house-floor { animation: none; } .house-roof { transition: none !important; } }
      `}</style>

      <ellipse
        cx={g.x + (g.width + dx) / 2}
        cy={g.groundY - dy / 2}
        rx={(g.width + dx) / 2 + 14}
        ry={dy / 2 + 7}
        fill={STROKE}
        opacity={0.1}
      />

      {g.floors.map((floor, i) => {
        const isGround = i === 0;
        const top = floor.y;
        const bottom = floor.y + floor.height;
        const xs = isGround
          ? windowXs(g.x + 12 + DOOR_WIDTH, right, Math.max(1, g.windowsPerFloor - 1))
          : windowXs(g.x, right, g.windowsPerFloor);
        const windowY = top + (floor.height - WINDOW) / 2 - (isGround ? 2 : 0);
        // Side-wall window: centred along the depth, skewed with the wall.
        const sideStart = 0.32;
        const sideEnd = 0.68;
        const sx0 = right + dx * sideStart;
        const sy0 = windowY - dy * sideStart;
        const sx1 = right + dx * sideEnd;
        const sy1 = windowY - dy * sideEnd;

        return (
          <g key={i} className="house-floor">
            <polygon
              points={pts([right, top], [right + dx, top - dy], [right + dx, bottom - dy], [right, bottom])}
              fill={SIDE}
              stroke={STROKE}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <polygon
              points={pts([sx0, sy0], [sx1, sy1], [sx1, sy1 + WINDOW], [sx0, sy0 + WINDOW])}
              fill={GLASS}
              stroke={STROKE}
              strokeWidth={1.25}
              strokeLinejoin="round"
            />
            <rect x={g.x} y={top} width={g.width} height={floor.height} fill={FRONT} stroke={STROKE} strokeWidth={1.5} />
            {xs.map((wx) => (
              <g key={wx}>
                <rect x={wx} y={windowY} width={WINDOW} height={WINDOW} rx={1.5} fill={GLASS} stroke={STROKE} strokeWidth={1.25} />
                <line x1={wx + WINDOW / 2} x2={wx + WINDOW / 2} y1={windowY} y2={windowY + WINDOW} stroke={STROKE} strokeWidth={0.75} />
                <line x1={wx} x2={wx + WINDOW} y1={windowY + WINDOW / 2} y2={windowY + WINDOW / 2} stroke={STROKE} strokeWidth={0.75} />
              </g>
            ))}
            {isGround && (
              <>
                <rect x={g.x + 12} y={g.groundY - DOOR_HEIGHT} width={DOOR_WIDTH} height={DOOR_HEIGHT} rx={1.5} fill={STROKE} />
                <circle cx={g.x + 12 + DOOR_WIDTH - 4} cy={g.groundY - DOOR_HEIGHT / 2} r={1.2} fill={FRONT} />
              </>
            )}
          </g>
        );
      })}

      {/* Moved as one piece onto the top floor so the move animates instead of snapping. */}
      <g className="house-roof" style={{ transform: `translateY(${roof.baseY}px)`, transition: MOTION }}>
        <polygon
          points={pts([roof.leftX, eaveY], ridgeFront, ridgeBack, [roof.leftX + dx, eaveY - dy])}
          fill={ROOF_DARK}
          stroke={STROKE}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <polygon
          points={pts(ridgeFront, [roof.rightX, eaveY], [roof.rightX + dx, eaveY - dy], ridgeBack)}
          fill={ROOF_LIGHT}
          stroke={STROKE}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <polygon
          points={pts([chimneyBaseX, chimneyBaseY + 4], [chimneyBaseX, chimneyBaseY - 16], [chimneyBaseX + 9, chimneyBaseY - 16], [chimneyBaseX + 9, chimneyBaseY + 2])}
          fill={SIDE}
          stroke={STROKE}
          strokeWidth={1.25}
          strokeLinejoin="round"
        />
        <polygon
          points={pts([chimneyBaseX, chimneyBaseY - 16], [chimneyBaseX + 5, chimneyBaseY - 19], [chimneyBaseX + 14, chimneyBaseY - 19], [chimneyBaseX + 9, chimneyBaseY - 16])}
          fill={ROOF_DARK}
          stroke={STROKE}
          strokeWidth={1.25}
          strokeLinejoin="round"
        />
        <polygon
          points={pts([g.x, 0], [peakX, -rise], [right, 0])}
          fill={FRONT}
          stroke={STROKE}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <circle cx={peakX} cy={-rise * 0.42} r={5} fill={GLASS} stroke={STROKE} strokeWidth={1.25} />
      </g>
    </svg>
  );
}
