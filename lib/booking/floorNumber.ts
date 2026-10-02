// Reads a floor sent by a booking form. Floors are whole numbers and may be
// negative (basements, e.g. -1); 0 means "not given" — also the fallback for
// anything that isn't a whole number.
export function parseFloorNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const floor = Number(value);
  return Number.isInteger(floor) ? floor : 0;
}
