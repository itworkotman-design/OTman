export type AddressSelectionMeta = {
  featureType: string;
  typedQuery: string;
  precise?: boolean;
};

// `precise` comes from /api/address-search's isPreciseMatch: false for a
// street-only match, and also false for a poi (business, bus stop, etc.)
// that Mapbox couldn't tie to a real street/house number — e.g. a suggestion
// that resolves to nothing more specific than "0692 Oslo, Norway".
export function isStreetOnlyMatch(meta?: AddressSelectionMeta | null): boolean {
  if (!meta) {
    return false;
  }

  return meta.precise === false || meta.featureType === "street";
}

export function appendImpreciseAddressNote(
  description: string,
  fieldLabel: string,
  typedQuery: string,
): string {
  const trimmedQuery = typedQuery.trim();

  if (!trimmedQuery || description.includes(trimmedQuery)) {
    return description;
  }

  const note = `${fieldLabel}: exact address not found on map, customer entered "${trimmedQuery}"`;
  const trimmedDescription = description.trim();

  return trimmedDescription ? `${trimmedDescription}\n${note}` : note;
}
