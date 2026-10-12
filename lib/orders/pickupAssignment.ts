// Once a homepage order is split across several pickup stops, every product
// card must be collected by exactly one of them — otherwise the driver has no
// address for it. With a single stop everything is collected there, so there
// is nothing to check.
//
// Returns the card ids that break that rule (none claimed, or more than one).
// A stop without an address doesn't count as collecting anything.
// Older orders whose stops only stored product names (no cardIds) can't be
// checked and pass.
export function findCardsWithoutPickup(
  pickups: { address?: string | null; cardIds?: number[] }[],
  cards: { cardId: number; productId: string | null }[],
): number[] {
  if (pickups.length <= 1) return [];
  if (pickups.some((stop) => !Array.isArray(stop.cardIds))) return [];

  const claims = new Map<number, number>();
  for (const stop of pickups) {
    if (typeof stop.address === "string" && !stop.address.trim()) continue;
    for (const cardId of new Set(stop.cardIds)) claims.set(cardId, (claims.get(cardId) ?? 0) + 1);
  }

  return cards.filter((card) => card.productId && claims.get(card.cardId) !== 1).map((card) => card.cardId);
}

// The other side of the same rule: once split, every pickup stop must collect
// something — an empty one means the products weren't divided up yet.
// Returns the stops' indexes. Older orders without cardIds pass, as above.
export function findPickupsWithoutProducts(pickups: { cardIds?: number[] }[]): number[] {
  if (pickups.length <= 1) return [];
  if (pickups.some((stop) => !Array.isArray(stop.cardIds))) return [];
  return pickups.flatMap((stop, i) => (stop.cardIds!.length === 0 ? [i] : []));
}
