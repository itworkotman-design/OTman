// Where AddressAutocompleteInput's `floating` suggestion list goes: fixed to
// the viewport (so no scrolling/overflow-hidden container, e.g. a modal's
// body, can clip it), under the input at its width — or above it when there's
// too little room below to be useful and more above. Heights shrink to the
// room available, never past max-h-72.
const GAP = 4;
const EDGE_MARGIN = 8;
const MAX_HEIGHT = 288;
const MIN_USEFUL_HEIGHT = 160;

export type AddressDropdownPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

export function addressDropdownPosition(
  rect: { top: number; bottom: number; left: number; width: number },
  viewportHeight: number,
): AddressDropdownPosition {
  const below = viewportHeight - (rect.bottom + GAP) - EDGE_MARGIN;
  const above = rect.top - GAP - EDGE_MARGIN;
  if (below < MIN_USEFUL_HEIGHT && above > below) {
    return {
      left: rect.left,
      width: rect.width,
      bottom: viewportHeight - rect.top + GAP,
      maxHeight: Math.min(MAX_HEIGHT, above),
    };
  }
  return { left: rect.left, width: rect.width, top: rect.bottom + GAP, maxHeight: Math.min(MAX_HEIGHT, Math.max(0, below)) };
}
