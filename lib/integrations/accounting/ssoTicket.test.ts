import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ACCOUNTING_SSO_AUDIENCE, createAccountingSsoTicket } from "./ssoTicket";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateKeyB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");

const user = { userId: "user-1", email: "ola@otman.no", name: "Ola" };
const now = new Date("2026-11-22T10:00:00.000Z");

describe("createAccountingSsoTicket", () => {
  it("signs who the user is for the accounting app, valid for 60 seconds, with a one-time ID", () => {
    const ticket = createAccountingSsoTicket(user, privateKeyB64, now);
    const [version, payload, signature] = ticket.split(".");

    expect(version).toBe("v1");
    expect(verify(null, Buffer.from(`v1.${payload}`), publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    expect(claims).toEqual({
      iss: "otman",
      aud: ACCOUNTING_SSO_AUDIENCE,
      sub: "user-1",
      email: "ola@otman.no",
      name: "Ola",
      iat: 1795341600,
      exp: 1795341660,
      jti: expect.stringMatching(/^[A-Za-z0-9_-]{22,}$/),
    });
  });

  it("gives every ticket its own ID", () => {
    const a = createAccountingSsoTicket(user, privateKeyB64, now).split(".")[1];
    const b = createAccountingSsoTicket(user, privateKeyB64, now).split(".")[1];
    expect(JSON.parse(Buffer.from(a, "base64url").toString()).jti).not.toBe(JSON.parse(Buffer.from(b, "base64url").toString()).jti);
  });

  it("refuses a key that isn't an Ed25519 private key", () => {
    const publicOnly = createPublicKey(privateKey).export({ format: "der", type: "spki" }).toString("base64");
    expect(() => createAccountingSsoTicket(user, publicOnly, now)).toThrow();
    expect(() => createAccountingSsoTicket(user, "not-a-key", now)).toThrow();
  });
});
