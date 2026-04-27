import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import {
  hashPassword,
  verifyPassword,
  verifyPasswordWithMetadata,
} from "./password";

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

  it("verifies a WordPress phpass hash and marks it for rehash", async () => {
    const result = await verifyPasswordWithMetadata(
      "$P$B55D6LjfHDkINU5wF.v2BuuzO0/XPk/",
      "test"
    );

    expect(result).toEqual({ valid: true, needsRehash: true });
  });

  it("verifies a current WordPress bcrypt hash and marks it for rehash", async () => {
    const password = "valid-password";
    const wordpressPassword = crypto
      .createHmac("sha384", "wp-sha384")
      .update(password)
      .digest("base64");
    const hash = `$wp${await bcrypt.hash(wordpressPassword, 10)}`;

    const result = await verifyPasswordWithMetadata(hash, password);

    expect(result).toEqual({ valid: true, needsRehash: true });
  });

  it("verifies a WordPress legacy MD5 hash and marks it for rehash", async () => {
    const result = await verifyPasswordWithMetadata(
      "1a1dc91c907325c69271ddf0c944bc72",
      "pass"
    );

    expect(result).toEqual({ valid: true, needsRehash: true });
  });
});
