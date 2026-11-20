import { createPrivateKey, randomBytes, sign } from "node:crypto";

/** Who a ticket is for: the OtmanAccounting app checks this. */
export const ACCOUNTING_SSO_AUDIENCE = "otman-accounting";
const TICKET_SECONDS = 60;

export type AccountingSsoUser = { userId: string; email: string; name: string };

/**
 * A one-time sign-in ticket for the OtmanAccounting app: "v1.<claims>.<signature>", the claims base64url JSON
 * (issuer, audience, the user's ID, email and name, issued / expiry times, a random one-time ID) signed with
 * Otman's Ed25519 private key (base64 PKCS#8 DER). The accounting app holds only the public key, so it can check
 * tickets but never make one. Valid for 60 seconds; the accounting app accepts each ID once.
 */
export function createAccountingSsoTicket(user: AccountingSsoUser, privateKeyB64: string, now = new Date()): string {
  const key = createPrivateKey({ key: Buffer.from(privateKeyB64, "base64"), format: "der", type: "pkcs8" });
  if (key.asymmetricKeyType !== "ed25519") throw new Error("ACCOUNTING_SSO_PRIVATE_KEY must be an Ed25519 private key");
  const iat = Math.floor(now.getTime() / 1000);
  const claims = {
    iss: "otman",
    aud: ACCOUNTING_SSO_AUDIENCE,
    sub: user.userId,
    email: user.email,
    name: user.name,
    iat,
    exp: iat + TICKET_SECONDS,
    jti: randomBytes(18).toString("base64url"),
  };
  const signed = `v1.${Buffer.from(JSON.stringify(claims), "utf8").toString("base64url")}`;
  return `${signed}.${sign(null, Buffer.from(signed), key).toString("base64url")}`;
}
