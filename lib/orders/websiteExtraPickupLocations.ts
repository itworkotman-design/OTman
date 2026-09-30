// The public homepage booking flow (WhiteGoodsBookingFlow) lets a customer
// split their order across several pickup addresses (see pickupLocations.ts
// on the client). There's no DB column linking an OrderItem to a specific
// pickup stop — that's a bigger, separate schema effort — so this is a
// best-effort front-end-to-description passthrough: extra locations' street
// addresses still feed the existing extraPickupAddress pricing/column, and
// which products go where is folded into the order's free-text description
// for staff to read, rather than being structured, queryable data.

const PICKUP_SOURCE_LABELS: Record<string, string> = {
  store: "Store",
  private: "Private individual",
  business: "Business",
};

export type ParsedExtraPickupLocation = {
  source: string | null;
  placeName: string | null;
  address: string | null;
  floor: number;
  liftAvailable: boolean;
  contactName: string | null;
  contactPhone: string | null;
  productNames: string[];
};

function str(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function productNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

// Parses the client's `extraPickupLocations` request field. Never throws —
// a malformed entry is either coerced to safe defaults or, if it has no
// usable address, dropped entirely (an extra pickup stop with nowhere to go
// isn't worth keeping).
export function parseExtraPickupLocations(value: unknown): ParsedExtraPickupLocation[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw): ParsedExtraPickupLocation | null => {
      if (!raw || typeof raw !== "object") return null;
      const v = raw as Record<string, unknown>;
      const address = str(v.address);
      if (!address) return null;

      const sourceKey = typeof v.source === "string" ? v.source : "";
      return {
        source: PICKUP_SOURCE_LABELS[sourceKey] ? sourceKey : null,
        placeName: str(v.placeName),
        address,
        floor: num(v.floor),
        liftAvailable: v.liftAvailable === true,
        contactName: str(v.contactName),
        contactPhone: str(v.contactPhone),
        productNames: productNames(v.productNames),
      };
    })
    .filter((loc): loc is ParsedExtraPickupLocation => loc !== null);
}

function describeLocation(index: number, address: string, detail: string | null, items: string[]): string {
  const head = detail ? `${address}, ${detail}` : address;
  const suffix = items.length > 0 ? ` — picking up: ${items.join(", ")}` : "";
  return `Pickup location ${index + 1} (${head})${suffix}`;
}

// Human-readable lines describing how an order's pickup was split across
// several locations, appended to the order's internal description — empty
// when the order was never split (the common case), so the description
// stays exactly as it always has for a single-location order.
export function buildMultiPickupDescriptionLines(params: {
  firstLocationAddress: string | null;
  firstLocationProductNames: string[];
  extraLocations: ParsedExtraPickupLocation[];
}): string[] {
  const { firstLocationAddress, firstLocationProductNames, extraLocations } = params;
  if (firstLocationProductNames.length === 0 && extraLocations.length === 0) return [];

  const lines: string[] = [];
  if (firstLocationAddress) {
    lines.push(describeLocation(0, firstLocationAddress, null, firstLocationProductNames));
  }
  extraLocations.forEach((loc, i) => {
    const detail = [
      loc.source ? PICKUP_SOURCE_LABELS[loc.source] : null,
      loc.placeName,
      loc.contactName || loc.contactPhone ? `contact: ${[loc.contactName, loc.contactPhone].filter(Boolean).join(" / ")}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(describeLocation(i + 1, loc.address ?? "—", detail || null, loc.productNames));
  });
  return lines;
}
