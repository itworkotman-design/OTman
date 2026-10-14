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

// The indices of the sections a retractedRevealedCount(...) call takes off
// screen — so each can be told it was retracted (StepSection.onRetract).
export function retractedSectionIndices(currentRevealedCount: number, fromIndex: number): number[] {
  const indices: number[] = [];
  for (let i = fromIndex + 1; i < currentRevealedCount; i++) indices.push(i);
  return indices;
}

// The sections currently on screen (revealed and not hidden).
export function shownSectionIds(sections: { id: string; hidden?: boolean }[]): string[] {
  return sections.filter((section) => !section.hidden).map((section) => section.id);
}

// Whether the modal should leave extra room below the stack: only while the
// bottom-most shown section asked for it (StepSection.bottomSpace).
export function showsBottomSpace(sections: { id: string; hidden?: boolean; bottomSpace?: boolean }[]): boolean {
  const shown = sections.filter((section) => !section.hidden);
  return !!shown[shown.length - 1]?.bottomSpace;
}

// Where the modal body should scroll when the final step toggles: its own page
// starts at the top; going back returns to the bottom of the steps, the last
// section the user was filling in.
export function finalStepScrollTarget(wasFinalStep: boolean, isFinalStep: boolean): "top" | "bottom" | null {
  if (wasFinalStep === isFinalStep) return null;
  return isFinalStep ? "top" : "bottom";
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

// Whether the final (review) step replaces the sections. The stepped flow
// reaches it by completing the last section; with every section open
// (`showAll`) there is no last section to complete, so only the caller can
// open it (`open`) — "My order"'s summary before saving.
export function isFinalStepShown(params: { showAll: boolean; reached: boolean; open?: boolean }): boolean {
  return params.showAll ? params.open === true : params.reached;
}

// Splits the revealed sections around an optional side column (SteppedModal's
// `aside`, e.g. the moving flow's one calculator): sections from `fromId` up
// to, not including, `untilId` sit in a two-column row beside it; the ones
// before and after stay full width. A missing `untilId` runs to the end.
export function asideSectionGroups<T extends { id: string }>(
  visible: T[],
  aside: { fromId: string; untilId: string } | undefined,
): { before: T[]; within: T[]; after: T[] } {
  const from = aside ? visible.findIndex((s) => s.id === aside.fromId) : -1;
  if (!aside || from === -1) return { before: visible, within: [], after: [] };
  const untilIndex = visible.findIndex((s) => s.id === aside.untilId);
  const until = untilIndex === -1 ? visible.length : untilIndex;
  return { before: visible.slice(0, from), within: visible.slice(from, until), after: visible.slice(until) };
}

// Whether a section shows faded (SteppedModal's `dimCompleted`): every
// revealed section before the one being answered, so the eye goes to the
// current question. Never with every section open at once (`showAll`).
export function isSectionDimmed(params: { index: number; revealedCount: number; showAll: boolean; enabled: boolean }): boolean {
  if (!params.enabled || params.showAll) return false;
  return params.index < params.revealedCount - 1;
}

// Whether a reveal brings a section on screen for the first time
// (SteppedModal's `scrollToNewSections`): past the furthest the flow has
// ever been revealed. Going back and changing an answer retracts the
// sections after it; revealing those again is not new, so the view stays put.
export function revealsUnseenSection(params: { furthestRevealed: number; revealedCount: number }): boolean {
  return params.revealedCount > params.furthestRevealed;
}

// Where to scroll the modal body to bring a newly revealed section into view
// (positions are in the scroller's content coordinates): down just enough to
// show all of it plus `padding`, but never past its top (a section taller
// than the view starts at the top). Null when no downward scroll is needed.
export function newSectionScrollTop(params: {
  scrollTop: number;
  viewportHeight: number;
  sectionTop: number;
  sectionBottom: number;
  padding: number;
}): number | null {
  const { scrollTop, viewportHeight, sectionTop, sectionBottom, padding } = params;
  const showBottom = sectionBottom + padding - viewportHeight;
  const target = Math.min(sectionTop - padding, Math.max(scrollTop, showBottom));
  return target > scrollTop ? target : null;
}
