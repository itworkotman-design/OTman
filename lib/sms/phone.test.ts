import { describe, expect, it } from "vitest";
import { normalizeSmsRecipient } from "./phone";

describe("normalizeSmsRecipient", () => {
  it("prefixes a bare 8-digit Norwegian number with 47", () => {
    expect(normalizeSmsRecipient("402 84 977")).toBe("4740284977");
    expect(normalizeSmsRecipient("40284977")).toBe("4740284977");
  });

  it("accepts + and 00 international prefixes", () => {
    expect(normalizeSmsRecipient("+47 402-84-977")).toBe("4740284977");
    expect(normalizeSmsRecipient("0047 40284977")).toBe("4740284977");
    expect(normalizeSmsRecipient("+46 (70) 123 45 67")).toBe("46701234567");
  });

  it("rejects empty, too short, too long, or non-numeric values", () => {
    expect(normalizeSmsRecipient(null)).toBeNull();
    expect(normalizeSmsRecipient("   ")).toBeNull();
    expect(normalizeSmsRecipient("12345")).toBeNull();
    expect(normalizeSmsRecipient("+1234567890123456")).toBeNull();
    expect(normalizeSmsRecipient("ring meg")).toBeNull();
    expect(normalizeSmsRecipient("4028x977")).toBeNull();
  });
});
