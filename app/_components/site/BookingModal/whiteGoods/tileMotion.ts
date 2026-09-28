// Product tiles change place (and a size-priced one changes width) the instant
// one is selected, because the grid reflows. To make that smooth the grid
// measures each tile before and after (FLIP) and plays the difference as an
// animation. This turns one tile's before/after box into its keyframes.
export type TileBox = { left: number; top: number; width: number };

const MIN_CHANGE_PX = 1;

export function getTileKeyframes(prev: TileBox, next: TileBox): Keyframe[] | null {
  const dx = prev.left - next.left;
  const dy = prev.top - next.top;
  const widthChanged = Math.abs(prev.width - next.width) >= MIN_CHANGE_PX;

  if (Math.abs(dx) < MIN_CHANGE_PX && Math.abs(dy) < MIN_CHANGE_PX && !widthChanged) return null;

  const from: Keyframe = { transform: `translate(${dx}px, ${dy}px)` };
  const to: Keyframe = { transform: "translate(0, 0)" };
  if (widthChanged) {
    from.width = `${prev.width}px`;
    to.width = `${next.width}px`;
  }
  return [from, to];
}
