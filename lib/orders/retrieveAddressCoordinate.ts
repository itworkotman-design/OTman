export type AddressCoordinate = { latitude: number; longitude: number };

// Client-side companion to GET /api/address-search/retrieve — Mapbox's own
// Search Box `/suggest` results never carry a coordinate, only a follow-up
// `/retrieve` call against the same session does. Used by both
// AddressAutocompleteInput and PickupAddressCombobox right after a suggestion
// is picked, so the caller can backfill AddressSelectionMeta.latitude/longitude
// without blocking the selection itself on the network round trip. Never
// throws — a failed lookup just means no coordinate for this pick.
export async function retrieveAddressCoordinate(
  id: string,
  sessionToken: string,
): Promise<AddressCoordinate | null> {
  if (!sessionToken) {
    return null;
  }

  try {
    const res = await fetch(
      `/api/address-search/retrieve?id=${encodeURIComponent(id)}&sessionToken=${encodeURIComponent(sessionToken)}`,
      { credentials: "include" },
    );
    const data = await res.json().catch(() => null);

    return data?.ok ? { latitude: data.latitude, longitude: data.longitude } : null;
  } catch {
    return null;
  }
}
