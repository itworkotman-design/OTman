// Pure state-transition logic for the reusable stepped modal: how many
// sections are revealed after a given section is completed. Kept
// framework-free so it can be unit tested without a DOM/React environment.

export function nextRevealedCount(currentRevealedCount: number, completedIndex: number, totalSections: number): number {
  const proposed = completedIndex + 2;
  return Math.min(Math.max(currentRevealedCount, proposed), totalSections);
}

// Hides every section after `fromIndex` again — used when a section whose
// completion was condition-driven (not a one-off button click) stops being
// satisfied, e.g. the user un-picks the product that had satisfied it.
// Section `fromIndex` itself stays revealed; only what came after it goes.
export function retractedRevealedCount(currentRevealedCount: number, fromIndex: number): number {
  return Math.min(currentRevealedCount, fromIndex + 1);
}

// The sections currently on screen (revealed and not hidden).
export function shownSectionIds(sections: { id: string; hidden?: boolean }[]): string[] {
  return sections.filter((section) => !section.hidden).map((section) => section.id);
}

export type SectionStructure = { ids: string[]; showFinalStep: boolean };

// True when the layout gained something: a section appeared (revealed or
// un-hidden), or the final step was entered/left, which swaps the whole body.
export function structureGainedSections(previous: SectionStructure, next: SectionStructure): boolean {
  if (previous.showFinalStep !== next.showFinalStep) return true;
  return next.ids.some((id) => !previous.ids.includes(id));
}

// What the modal's content-height hold should do when the layout changes. A
// newly added section starts collapsed and animates open (often while it
// replaces another), so the old height is held until it has. Sections that only
// leave fade and collapse on their own, so there is nothing to hold — except
// that a hold from an earlier addition may still be pending (the new section can
// retract the ones after it the moment it mounts); ending that hold early would
// shrink the content and clamp the scroll position upward.
export type HeightHoldAction = "hold-then-release" | "keep-holding" | "none";

export function heightHoldAction({ gained, holdPending }: { gained: boolean; holdPending: boolean }): HeightHoldAction {
  if (gained) return "hold-then-release";
  return holdPending ? "keep-holding" : "none";
}

// Items to render so that ones which just left the list can still animate out:
// the current items, plus each previous item that is gone, kept right after the
// item that preceded it (or first). Present items use their current version.
export function withExitingItems<T extends { key: string }>(previous: T[], current: T[]): T[] {
  const currentKeys = new Set(current.map((item) => item.key));
  const merged = [...current];
  previous.forEach((item, index) => {
    if (currentKeys.has(item.key)) return;
    const before = previous[index - 1];
    const at = before ? merged.findIndex((m) => m.key === before.key) : -1;
    merged.splice(at + 1, 0, item);
  });
  return merged;
}

// Percentage (0-100) the progress bar should fill for the given reveal
// state. totalSections <= 0 is treated as "nothing to fill" rather than
// dividing by zero.
export function progressPercent(revealedCount: number, totalSections: number): number {
  if (totalSections <= 0) return 0;
  return Math.min(100, Math.max(0, (revealedCount / totalSections) * 100));
}
