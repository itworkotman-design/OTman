// Pure state-transition logic for the reusable stepped modal: how many
// sections are revealed after a given section is completed. Kept
// framework-free so it can be unit tested without a DOM/React environment.

export function nextRevealedCount(currentRevealedCount: number, completedIndex: number, totalSections: number): number {
  const proposed = completedIndex + 2;
  return Math.min(Math.max(currentRevealedCount, proposed), totalSections);
}

// Percentage (0-100) the progress bar should fill for the given reveal
// state. totalSections <= 0 is treated as "nothing to fill" rather than
// dividing by zero.
export function progressPercent(revealedCount: number, totalSections: number): number {
  if (totalSections <= 0) return 0;
  return Math.min(100, Math.max(0, (revealedCount / totalSections) * 100));
}
