import { getChargeableFloors } from "@/lib/booking/pricing/buildWhiteGoodsCalculatorBreakdowns";

// Reads a floor sent by a booking form. Floors are whole numbers and may be
// negative (basements, e.g. -1); 0 means "not given" — also the fallback for
// anything that isn't a whole number.
export function parseFloorNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const floor = Number(value);
  return Number.isInteger(floor) ? floor : 0;
}

// The one floor to keep when an order can only store a single combined
// floor (Order.floorNo): whichever would cost more without a lift, so a deep
// basement isn't lost to a higher but free floor. Ties keep the higher floor.
export function costliestFloor(a: number, b: number): number {
  const costA = getChargeableFloors(a, false);
  const costB = getChargeableFloors(b, false);
  if (costA !== costB) return costA > costB ? a : b;
  return Math.max(a, b);
}
