"use client";

import { useEffect } from "react";

// Renders nothing — just watches `ready` and advances the section the
// moment it flips true, so no section needs its own bottom "Continue"
// button. If `ready` later flips back to false (e.g. the user un-picks the
// product that had satisfied it), retracts any sections revealed after
// this one instead of leaving them stranded ahead of an unsatisfied step.
// `onReady`/`onRetract` (SteppedModal's onComplete/onUncomplete) are new
// function identities every render; only the `ready` transition should
// re-trigger this. While `hold` is true an unready section leaves the ones
// after it alone; `hold` dropping while still unready retracts them then.
// Shared by every SteppedModal flow (white goods, moving).
export function AutoAdvance({
  ready,
  hold = false,
  onReady,
  onRetract,
}: {
  ready: boolean;
  hold?: boolean;
  onReady: () => void;
  onRetract: () => void;
}) {
  useEffect(() => {
    if (ready) onReady();
    else if (!hold) onRetract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ready || hold]);
  return null;
}
