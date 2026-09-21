// Strips fields from a partial update that already match the current value.
// Effects that normalize state and call onChange whenever the patch is
// non-empty must use this — otherwise a no-op assignment (e.g. setting an
// already-null id to null) yields a fresh object every render and loops.
export function dropUnchangedFields<T extends object>(
  current: T,
  patch: Partial<T>,
): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (JSON.stringify(patch[key]) !== JSON.stringify(current[key])) {
      result[key] = patch[key];
    }
  }

  return result;
}
