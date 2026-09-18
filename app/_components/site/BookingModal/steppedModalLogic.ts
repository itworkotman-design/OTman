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

// Percentage (0-100) the progress bar should fill for the given reveal
// state. totalSections <= 0 is treated as "nothing to fill" rather than
// dividing by zero.
export function progressPercent(revealedCount: number, totalSections: number): number {
  if (totalSections <= 0) return 0;
  return Math.min(100, Math.max(0, (revealedCount / totalSections) * 100));
}
