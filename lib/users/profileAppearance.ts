const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const USER_LOGO_PREFIX = "/uploads/user-logos/";
const USER_LOGO_S3_PREFIX = "s3://orders/user-logos/";
const USER_LOGO_ROUTE = "/api/auth/users/logo";

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

  const isManagedLocalLogo = trimmed.startsWith(USER_LOGO_PREFIX);
  const isManagedS3Logo = trimmed.startsWith(USER_LOGO_S3_PREFIX);

  if ((!isManagedLocalLogo && !isManagedS3Logo) || trimmed.includes("..")) {
    return null;
  }

  return trimmed;
}

export function isManagedUserLogoPath(value: string | null | undefined): boolean {
  return normalizeUserLogoPath(value) !== null;
}

export function isS3UserLogoPath(value: string | null | undefined): boolean {
  return normalizeUserLogoPath(value)?.startsWith(USER_LOGO_S3_PREFIX) ?? false;
}

export function getUserLogoDisplayPath(value: string | null | undefined): string | null {
  const logoPath = normalizeUserLogoPath(value);

  if (!logoPath) {
    return null;
  }

  if (isS3UserLogoPath(logoPath)) {
    return `${USER_LOGO_ROUTE}?path=${encodeURIComponent(logoPath)}`;
  }

  return logoPath;
}
