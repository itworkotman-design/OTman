import {
  getOptionalEmailError,
  getOptionalPhoneError,
  normalizeOptionalEmail,
  normalizeOptionalPhone,
} from "@/lib/orders/contactValidation";

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
};

export function createEmptyExtraPickup(): ExtraPickupInput {
  return {
    address: "",
    phone: "",
    email: "",
    sendEmail: true,
    customPickupAddressId: null,
    customPickupAddressName: null,
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
        // The name/coordinates are never trusted from the client — only the
        // id survives parsing (see resolveExtraPickupCustomAddresses.ts,
        // which re-derives the rest from the authoritative saved-address
        // record server-side).
        customPickupAddressId:
          typeof candidate?.customPickupAddressId === "string" &&
          candidate.customPickupAddressId.trim().length > 0
            ? candidate.customPickupAddressId.trim()
            : null,
        customPickupAddressName: null,
        latitude: null,
        longitude: null,
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
