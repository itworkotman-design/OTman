const FREE_DISTANCE_KM = 20;

// Orders created from this moment on pay for the full distance once it is over
// 20 km (getFullChargeableKilometers). Orders created before it keep the old
// "only km above 20" rule (getStartedChargeableKilometers), because the
// dashboard re-prices existing orders live from drivingDistance.
export const FULL_DISTANCE_KM_PRICING_FROM = new Date("2026-10-06T00:00:00+02:00");

// Old rule: every started kilometer above the free 20 km.
export function getStartedChargeableKilometers(
  totalDistanceKm: number,
): number {
  if (!Number.isFinite(totalDistanceKm) || totalDistanceKm <= FREE_DISTANCE_KM) {
    return 0;
  }

  const kilometersOverBase = totalDistanceKm - FREE_DISTANCE_KM;

  return Math.ceil(kilometersOverBase - Number.EPSILON);
}

// New rule: free up to 20 km, then every started kilometer of the whole distance.
export function getFullChargeableKilometers(totalDistanceKm: number): number {
  if (!Number.isFinite(totalDistanceKm) || totalDistanceKm <= FREE_DISTANCE_KM) {
    return 0;
  }

  return Math.ceil(totalDistanceKm - Number.EPSILON);
}

// Orders without a (valid) creation date are new, unsaved orders.
export function usesFullDistanceKmPricing(
  createdAt: Date | string | null | undefined,
): boolean {
  if (createdAt == null) {
    return true;
  }

  const createdAtMs = new Date(createdAt).getTime();

  if (!Number.isFinite(createdAtMs)) {
    return true;
  }

  return createdAtMs >= FULL_DISTANCE_KM_PRICING_FROM.getTime();
}
