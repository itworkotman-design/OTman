import crypto from "node:crypto";
import argon2 from "argon2";
import bcrypt from "bcryptjs";

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MB
  timeCost: 2,
  parallelism: 1,
};

const PHPASS_ITOA64 =
  "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const PHPASS_HASH_PREFIX = "$P$";
const PHPASS_HASH_LENGTH = 34;

export type PasswordVerificationResult = {
  valid: boolean;
  needsRehash: boolean;
};

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  return argon2.hash(plain, ARGON2_OPTIONS);
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function encodePhpass64(input: Buffer, count: number): string {
  let output = "";
  let i = 0;

  do {
    let value = input[i++];
    output += PHPASS_ITOA64[value & 0x3f];

    if (i < count) {
      value |= input[i] << 8;
    }

    output += PHPASS_ITOA64[(value >> 6) & 0x3f];

    if (i++ >= count) {
      break;
    }

    if (i < count) {
      value |= input[i] << 16;
    }

    output += PHPASS_ITOA64[(value >> 12) & 0x3f];

    if (i++ >= count) {
      break;
    }

    output += PHPASS_ITOA64[(value >> 18) & 0x3f];
  } while (i < count);

  return output;
}

function verifyWordpressPhpass(hash: string, plain: string): boolean {
  if (!hash.startsWith(PHPASS_HASH_PREFIX) || hash.length !== PHPASS_HASH_LENGTH) {
    return false;
  }

  const countLog2 = PHPASS_ITOA64.indexOf(hash[3]);

  if (countLog2 < 7 || countLog2 > 30) {
    return false;
  }

  const salt = hash.slice(4, 12);

  if (salt.length !== 8) {
    return false;
  }

  let computed = crypto
    .createHash("md5")
    .update(salt + plain)
    .digest();
  const iterations = 1 << countLog2;

  for (let i = 0; i < iterations; i += 1) {
    computed = crypto
      .createHash("md5")
      .update(Buffer.concat([computed, Buffer.from(plain)]))
      .digest();
  }

  const encoded = PHPASS_HASH_PREFIX + hash[3] + salt + encodePhpass64(computed, 16);

  return timingSafeEqualString(encoded, hash);
}

async function verifyWordpressBcrypt(hash: string, plain: string): Promise<boolean> {
  const hashToVerify = hash.startsWith("$wp") ? hash.slice(3) : hash;
  const passwordToVerify = hash.startsWith("$wp")
    ? crypto
        .createHmac("sha384", "wp-sha384")
        .update(plain)
        .digest("base64")
    : plain;

  try {
    return await bcrypt.compare(passwordToVerify, hashToVerify);
  } catch {
    return false;
  }
}

async function verifyWordpressPassword(
  hash: string,
  plain: string
): Promise<boolean> {
  if (hash.length <= 32 && /^[a-f0-9]{32}$/.test(hash)) {
    const md5 = crypto.createHash("md5").update(plain).digest("hex");
    return timingSafeEqualString(md5, hash);
  }

  if (hash.startsWith(PHPASS_HASH_PREFIX)) {
    return verifyWordpressPhpass(hash, plain);
  }

  if (
    hash.startsWith("$wp") ||
    hash.startsWith("$2a$") ||
    hash.startsWith("$2b$") ||
    hash.startsWith("$2y$")
  ) {
    return verifyWordpressBcrypt(hash, plain);
  }

  return false;
}

export async function verifyPasswordWithMetadata(
  hash: string,
  plain: string
): Promise<PasswordVerificationResult> {
  if (!hash || !plain) {
    return { valid: false, needsRehash: false };
  }

  try {
    if (await argon2.verify(hash, plain)) {
      return { valid: true, needsRehash: false };
    }
  } catch {
    // Continue to WordPress compatibility checks.
  }

  const wordpressValid = await verifyWordpressPassword(hash, plain);

  return {
    valid: wordpressValid,
    needsRehash: wordpressValid,
  };
}

export async function verifyPassword(
  hash: string,
  plain: string
): Promise<boolean> {
  return (await verifyPasswordWithMetadata(hash, plain)).valid;
}
