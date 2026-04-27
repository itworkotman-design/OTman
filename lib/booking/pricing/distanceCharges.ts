export function getStartedChargeableKilometers(
  totalDistanceKm: number,
): number {
  if (!Number.isFinite(totalDistanceKm) || totalDistanceKm <= 20) {
    return 0;
  }

  const kilometersOverBase = totalDistanceKm - 20;

  return Math.ceil(kilometersOverBase - Number.EPSILON);
}

