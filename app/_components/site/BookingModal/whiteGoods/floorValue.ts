// Floors in the booking flow count from 1 (the ground floor, Norwegian
// "1. etasje") — there is no floor 0. null means not chosen yet, which keeps
// the (required) field empty instead of pre-filling an answer.

// What the floor box's text means: a whole floor of 1 or more, or null for
// an empty box, 0, or anything else that isn't a floor.
export function parseFloorInput(text: string): number | null {
  const floor = Math.floor(Number(text));
  return text.trim() && Number.isFinite(floor) && floor >= 1 ? floor : null;
}

// One step of the up/down stepper. From nothing chosen, either direction
// lands on the ground floor.
export function stepFloor(current: number | null, direction: 1 | -1): number {
  if (current === null) return 1;
  return Math.max(1, current + direction);
}
