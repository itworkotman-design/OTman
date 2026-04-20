import {
  DEFAULT_PHONE_PREFIX,
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
};

export function createEmptyExtraPickup(): ExtraPickupInput {
  return {
    address: "",
    phone: DEFAULT_PHONE_PREFIX,
    email: "",
    sendEmail: true,
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
      };
    })
    .filter((pickup) => pickup.address.length > 0);
}

export function getExtraPickupValidation(
  pickup: Pick<ExtraPickupInput, "phone" | "email">,
): ExtraPickupValidation {
  const normalizedPhone = normalizeOptionalPhone(pickup.phone);
  const normalizedEmail = normalizeOptionalEmail(pickup.email);

  return {
    phoneError: getOptionalPhoneError(pickup.phone),
    emailError: getOptionalEmailError(pickup.email),
    contactError:
      normalizedPhone || normalizedEmail
        ? null
        : "Enter a phone number or an email address.",
    phoneRequired: !normalizedEmail,
    emailRequired: !normalizedPhone,
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
  }));
}

export function getExtraPickupApiError(
  extraPickups: ExtraPickupInput[],
): string | null {
  for (const [index, pickup] of extraPickups.entries()) {
    const validation = getExtraPickupValidation(pickup);

    if (validation.contactError) {
      return `Extra pickup ${index + 1} needs a phone number or email address.`;
    }

    if (validation.phoneError) {
      return `Extra pickup ${index + 1}: ${validation.phoneError}`;
    }

    if (validation.emailError) {
      return `Extra pickup ${index + 1}: ${validation.emailError}`;
    }
  }

  return null;
}
