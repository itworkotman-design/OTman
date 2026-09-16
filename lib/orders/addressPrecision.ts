export type AddressSelectionMeta = {
  featureType: string;
  typedQuery: string;
  precise?: boolean;
  // Populated when a coordinate is known for the selected address — either a
  // saved pickup/return location's own stored lat/lng, or one fetched from
  // Mapbox's Search Box `/retrieve` for a freely-searched suggestion. Absent
  // (not just null) when the caller never attempted to resolve one.
  latitude?: number | null;
  longitude?: number | null;
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

// The labels appendImpreciseAddressNote can prefix a generated note with, in
// every locale bookingText knows about — needed here since the note itself
// carries no other marker of which address field it's about.
const IMPRECISE_ADDRESS_FIELD_LABELS = {
  pickupAddress: ["Pickup address", "Henteadresse"],
  deliveryAddress: ["Delivery address", "Leveringsadresse"],
  returnAddress: ["Return address", "Returadresse"],
} as const;

export type ImpreciseAddressField = keyof typeof IMPRECISE_ADDRESS_FIELD_LABELS;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// order.description is a single shared free-text box, so an
// appendImpreciseAddressNote() call for one address field lands in the same
// string used to build every GSM task's description — a "Delivery address:
// ..." note would otherwise show up on the pickup and return tasks too, not
// just the delivery one. Called once per task with that task's own field so
// only its own note (if any) survives; any hand-typed text is left alone.
export function filterImpreciseAddressNotesForTask(
  description: string | null | undefined,
  field: ImpreciseAddressField,
): string {
  const text = description ?? "";

  if (!text) {
    return text;
  }

  const otherLabels = Object.entries(IMPRECISE_ADDRESS_FIELD_LABELS)
    .filter(([key]) => key !== field)
    .flatMap(([, labels]) => labels);

  const pattern = new RegExp(
    `^(?:${otherLabels.map(escapeRegExp).join("|")}): exact address not found on map, customer entered ".*"$`,
  );

  return text
    .split("\n")
    .filter((line) => !pattern.test(line.trim()))
    .join("\n");
}
