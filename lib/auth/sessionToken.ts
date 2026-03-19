import crypto from "crypto";

const TOKEN_BYTE_LENGTH = 32;

export function generateSessionToken(): string {
  return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
}

export function hashSessionToken(token: string): string {
  if (!token) {
    throw new Error("Token is required");
  }

  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifySessionToken(
  storedHash: string,
  providedToken: string
): boolean {
  if (!storedHash || !providedToken) {
    return false;
  }

  const providedHash = hashSessionToken(providedToken);

  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(providedHash, "hex");

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}
