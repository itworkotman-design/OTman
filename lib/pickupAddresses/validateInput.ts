import {
  DEFAULT_ADDRESS_COLOR,
  DEFAULT_ADDRESS_ICON,
  isAddressColorKey,
  isAddressIconKey,
  type AddressColorKey,
  type AddressIconKey,
} from "./addressAppearance";

export type CustomPickupAddressInput = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  icon: AddressIconKey;
  color: AddressColorKey;
};

export type ValidationResult =
  | { ok: true; value: CustomPickupAddressInput }
  | { ok: false; error: { reason: string; message: string } };

function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) ? num : null;
}

// Shared by the create and update routes so both enforce identical rules —
// required name/address, and lat/lng within valid geographic ranges. Kept
// generic over "unknown" body input since it's called directly on parsed
// JSON request bodies.
export function validateCustomPickupAddressInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: { reason: "INVALID_BODY", message: "Request body is required." },
    };
  }

  const input = body as Record<string, unknown>;
  const name = toTrimmedString(input.name);

  if (!name) {
    return {
      ok: false,
      error: { reason: "NAME_REQUIRED", message: "Name is required." },
    };
  }

  const address = toTrimmedString(input.address);

  if (!address) {
    return {
      ok: false,
      error: { reason: "ADDRESS_REQUIRED", message: "Address is required." },
    };
  }

  const latitude = toFiniteNumber(input.latitude);

  if (latitude === null || latitude < -90 || latitude > 90) {
    return {
      ok: false,
      error: {
        reason: "INVALID_LATITUDE",
        message: "Latitude must be a number between -90 and 90.",
      },
    };
  }

  const longitude = toFiniteNumber(input.longitude);

  if (longitude === null || longitude < -180 || longitude > 180) {
    return {
      ok: false,
      error: {
        reason: "INVALID_LONGITUDE",
        message: "Longitude must be a number between -180 and 180.",
      },
    };
  }

  // Icon/color come from a fixed picker, not free text — an unrecognized
  // value (bad request, stale client) just falls back to the default rather
  // than failing the whole save.
  const icon = isAddressIconKey(input.icon) ? input.icon : DEFAULT_ADDRESS_ICON;
  const color = isAddressColorKey(input.color) ? input.color : DEFAULT_ADDRESS_COLOR;

  return { ok: true, value: { name, address, latitude, longitude, icon, color } };
}
