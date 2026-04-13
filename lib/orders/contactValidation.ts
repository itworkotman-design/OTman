export const DEFAULT_PHONE_PREFIX = "+47";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]+$/;

export function normalizeOptionalEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function normalizeOptionalPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s+/g, "");
  return normalized === DEFAULT_PHONE_PREFIX ? null : normalized;
}

export function getOptionalEmailError(value: unknown): string | null {
  const email = normalizeOptionalEmail(value);

  if (!email) return null;
  if (email.length > 254) return "Email is too long.";
  if (!EMAIL_REGEX.test(email)) return "Enter a valid email address.";

  return null;
}

export function getOptionalPhoneError(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!PHONE_REGEX.test(trimmed)) {
    return "Phone number contains invalid characters.";
  }

  const normalized = normalizeOptionalPhone(trimmed);
  if (!normalized) return null;

  if (normalized.length < 7 || normalized.length > 20) {
    return "Phone number must be 7 to 20 characters.";
  }

  return null;
}
