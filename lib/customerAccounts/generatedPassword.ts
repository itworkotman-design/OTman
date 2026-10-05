import { randomInt } from "crypto";

// The password a temporary customer account is created with (see
// ensureCustomerAccount.ts). The customer types it from an email, often on a
// phone, so characters that look alike (0/O, 1/l/I) are left out — 57
// symbols × 12 characters is still ~70 bits.
export const CUSTOMER_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const CUSTOMER_PASSWORD_LENGTH = 12;

export function generateCustomerPassword(): string {
  let password = "";
  for (let i = 0; i < CUSTOMER_PASSWORD_LENGTH; i++) {
    password += CUSTOMER_PASSWORD_ALPHABET[randomInt(CUSTOMER_PASSWORD_ALPHABET.length)];
  }
  return password;
}
