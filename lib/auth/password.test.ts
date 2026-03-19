import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes and verifies a valid password", async () => {
    const password = "correct-horse-battery-staple";

    const hash = await hashPassword(password);

    expect(hash).toBeTypeOf("string");
    expect(hash).not.toBe(password);

    const ok = await verifyPassword(hash, password);
    expect(ok).toBe(true);
  });

  it("fails verification for wrong password", async () => {
    const hash = await hashPassword("valid-password");

    const ok = await verifyPassword(hash, "wrong-password");
    expect(ok).toBe(false);
  });

  it("rejects short passwords", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });
});
