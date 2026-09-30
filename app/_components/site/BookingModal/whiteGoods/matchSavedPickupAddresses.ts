export type SavedPickupAddress = {
  id: string;
  name: string;
  address: string;
  // Same curated icon/color allow-list the dashboard's saved locations use
  // (see lib/pickupAddresses/addressAppearance) — shown as a small badge
  // next to the row.
  icon: string;
  color: string;
};

// Below this, almost anything would "match" — not a useful suggestion yet.
const MIN_QUERY_LENGTH = 2;

// Loose, case-insensitive substring match against either the saved
// location's name or its address — the same rule the dashboard's
// PickupAddressCombobox already uses for its own saved-locations list.
export function matchSavedPickupAddresses(
  query: string,
  addresses: SavedPickupAddress[],
): SavedPickupAddress[] {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH) {
    return [];
  }

  return addresses.filter(
    (address) => address.name.toLowerCase().includes(q) || address.address.toLowerCase().includes(q),
  );
}
