const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const USER_LOGO_PREFIX = "/uploads/user-logos/";

export function normalizeUsernameDisplayColor(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return HEX_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function normalizeUserLogoPath(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith(USER_LOGO_PREFIX) || trimmed.includes("..")) {
    return null;
  }

  return trimmed;
}

export function isManagedUserLogoPath(value: string | null | undefined): boolean {
  return normalizeUserLogoPath(value) !== null;
}
