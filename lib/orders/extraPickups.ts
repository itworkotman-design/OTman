import {
  getOptionalEmailError,
  getOptionalPhoneError,
  normalizeOptionalEmail,
  normalizeOptionalPhone,
} from "@/lib/orders/contactValidation";
import { optionalCoordinate } from "@/lib/orders/normalizeOrderInput";

export type ExtraPickupInput = {
  address: string;
  phone: string;
  email: string;
  sendEmail: boolean;
  // Set only when this pickup came from a saved pickup address — same
  // server-resolved-and-authoritative pattern as the main pickup/return
  // address fields on Order. Never trust these beyond the id on the client
  // side — lib/orders/resolveExtraPickupCustomAddresses.ts re-derives the
  // rest server-side from the authoritative saved-address record. (That
  // resolution lives in its own module, not here, because this file is
  // imported by the client-side BookingEditor component and must stay free
  // of any lib/db.ts / Prisma dependency.)
  customPickupAddressId: string | null;
  customPickupAddressName: string | null;
  customPickupAddressPhone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ExtraPickupValidation = {
  phoneError: string | null;
  emailError: string | null;
  contactError: string | null;
  phoneRequired: boolean;
  emailRequired: boolean;
};

type ExtraPickupCandidate = {
  address?: unknown;
  phone?: unknown;
  email?: unknown;
  sendEmail?: unknown;
  customPickupAddressId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

export function createEmptyExtraPickup(): ExtraPickupInput {
  return {
    address: "",
    phone: "",
    email: "",
    sendEmail: true,
    customPickupAddressId: null,
    customPickupAddressName: null,
    customPickupAddressPhone: null,
    latitude: null,
    longitude: null,
  };
}

export function parseExtraPickups(value: unknown): ExtraPickupInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const candidate =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as ExtraPickupCandidate)
          : null;

      // The name/coordinates are never trusted from the client when tied to
      // a saved address — only the id survives parsing (see
      // resolveExtraPickupCustomAddresses.ts, which re-derives the rest from
      // the authoritative saved-address record server-side). A pickup with
      // no saved-address id is a manually-found address instead, where the
      // client's own submitted coordinate (from Mapbox, via our own retrieve
      // proxy) is the only source of truth there is — kept if it's a
      // plausible lat/lng, dropped otherwise.
      const customPickupAddressId =
        typeof candidate?.customPickupAddressId === "string" &&
        candidate.customPickupAddressId.trim().length > 0
          ? candidate.customPickupAddressId.trim()
          : null;

      return {
        address:
          typeof candidate?.address === "string"
            ? candidate.address.trim()
            : "",
        phone:
          typeof candidate?.phone === "string" ? candidate.phone.trim() : "",
        email:
          typeof candidate?.email === "string" ? candidate.email.trim() : "",
        sendEmail: candidate?.sendEmail === false ? false : true,
        customPickupAddressId,
        customPickupAddressName: null,
        customPickupAddressPhone: null,
        latitude: customPickupAddressId ? null : optionalCoordinate(candidate?.latitude, -90, 90),
        longitude: customPickupAddressId ? null : optionalCoordinate(candidate?.longitude, -180, 180),
      };
    })
    .filter((pickup) => pickup.address.length > 0);
}

// Re-reads an order's own already-persisted extraPickupContacts JSON — the
// server's own prior output, not client input — so it must NOT go through
// parseExtraPickups, which deliberately nulls out customPickupAddressName/
// Phone because it exists to strip a client's spoofed values. Used by the
// order edit route to seed "no change" defaults for a PATCH that doesn't
// touch extraPickups at all; going through parseExtraPickups there was
// silently wiping every extra pickup's saved warehouse name/phone back to
// null on any unrelated field edit, since that value gets written back
// unconditionally on every PATCH.
export function readStoredExtraPickups(value: unknown): ExtraPickupInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const candidate =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : null;

      return {
        address: typeof candidate?.address === "string" ? candidate.address : "",
        phone: typeof candidate?.phone === "string" ? candidate.phone : "",
        email: typeof candidate?.email === "string" ? candidate.email : "",
        sendEmail: candidate?.sendEmail !== false,
        customPickupAddressId:
          typeof candidate?.customPickupAddressId === "string" ? candidate.customPickupAddressId : null,
        customPickupAddressName:
          typeof candidate?.customPickupAddressName === "string" ? candidate.customPickupAddressName : null,
        customPickupAddressPhone:
          typeof candidate?.customPickupAddressPhone === "string" ? candidate.customPickupAddressPhone : null,
        latitude: typeof candidate?.latitude === "number" ? candidate.latitude : null,
        longitude: typeof candidate?.longitude === "number" ? candidate.longitude : null,
      };
    })
    .filter((pickup) => pickup.address.length > 0);
}

export function getExtraPickupValidation(
  pickup: Pick<ExtraPickupInput, "phone" | "email">,
): ExtraPickupValidation {
  return {
    phoneError: getOptionalPhoneError(pickup.phone),
    emailError: getOptionalEmailError(pickup.email),
    contactError: null,
    phoneRequired: false,
    emailRequired: false,
  };
}

export function normalizeExtraPickups(
  extraPickups: ExtraPickupInput[],
): ExtraPickupInput[] {
  return extraPickups.map((pickup) => ({
    address: pickup.address.trim(),
    phone: normalizeOptionalPhone(pickup.phone) ?? "",
    email: normalizeOptionalEmail(pickup.email) ?? "",
    sendEmail: pickup.sendEmail,
    customPickupAddressId: pickup.customPickupAddressId ?? null,
    customPickupAddressName: pickup.customPickupAddressName ?? null,
    customPickupAddressPhone: pickup.customPickupAddressPhone ?? null,
    latitude: pickup.latitude ?? null,
    longitude: pickup.longitude ?? null,
  }));
}

export function getExtraPickupApiError(
  extraPickups: ExtraPickupInput[],
): string | null {
  for (const [index, pickup] of extraPickups.entries()) {
    const validation = getExtraPickupValidation(pickup);

    if (validation.phoneError) {
      return `Extra pickup ${index + 1}: ${validation.phoneError}`;
    }

    if (validation.emailError) {
      return `Extra pickup ${index + 1}: ${validation.emailError}`;
    }
  }

  return null;
}
