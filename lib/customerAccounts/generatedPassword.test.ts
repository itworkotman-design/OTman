import { describe, expect, it } from "vitest";
import { CUSTOMER_PASSWORD_ALPHABET, CUSTOMER_PASSWORD_LENGTH, generateCustomerPassword } from "./generatedPassword";

describe("generateCustomerPassword", () => {
  it("is 12 characters long", () => {
    expect(CUSTOMER_PASSWORD_LENGTH).toBe(12);
    expect(generateCustomerPassword()).toHaveLength(12);
  });

  it("only uses characters that can't be mistaken for each other", () => {
    for (const ambiguous of ["0", "O", "1", "l", "I"]) {
      expect(CUSTOMER_PASSWORD_ALPHABET).not.toContain(ambiguous);
    }
    for (let i = 0; i < 200; i++) {
      for (const char of generateCustomerPassword()) {
        expect(CUSTOMER_PASSWORD_ALPHABET).toContain(char);
      }
    }
  });

  it("is different every time", () => {
    const passwords = new Set(Array.from({ length: 500 }, () => generateCustomerPassword()));
    expect(passwords.size).toBe(500);
  });
});
