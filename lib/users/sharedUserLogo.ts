import { createHash } from "crypto";

// User logos are stored content-addressed so identical pictures share one
// file (and one entry in the user modal's "Previously used pictures").
export function hashUserLogoBytes(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const SHARED_USER_LOGO_KEY_PREFIX = "orders/user-logos/shared/";

function sharedKeyForHash(hash: string, ext: string): string {
  return `${SHARED_USER_LOGO_KEY_PREFIX}${hash}${ext.toLowerCase()}`;
}

export function getSharedUserLogoKey(bytes: Buffer | Uint8Array, ext: string): string {
  return sharedKeyForHash(hashUserLogoBytes(bytes), ext);
}

export type UserLogoDedupeStep = {
  hash: string;
  // Where every user/invite with one of `replacePaths` should point afterwards.
  targetPath: string;
  // An existing copy to read the bytes from when `targetPath` isn't stored yet.
  sourcePath: string;
  // Old paths to repoint to `targetPath` and then delete.
  replacePaths: string[];
};

// Groups logo files by content hash (from scripts/dedupe-user-logos.ts) and
// plans moving each group onto its content-addressed shared path — the same
// path a fresh upload of that picture gets — so duplicates collapse to one.
export function planUserLogoDedupe(
  entries: Array<{ logoPath: string; hash: string }>,
): UserLogoDedupeStep[] {
  const byHash = new Map<string, string[]>();
  for (const { logoPath, hash } of entries) {
    const paths = byHash.get(hash) ?? [];
    if (!paths.includes(logoPath)) paths.push(logoPath);
    byHash.set(hash, paths);
  }

  const steps: UserLogoDedupeStep[] = [];
  for (const [hash, paths] of byHash) {
    const sharedPrefix = `s3://${SHARED_USER_LOGO_KEY_PREFIX}${hash}`;
    const existingShared = paths.find((p) => p.startsWith(sharedPrefix));
    const ext = paths[0].match(/\.[a-z0-9]+$/i)?.[0] ?? "";
    const targetPath = existingShared ?? `s3://${sharedKeyForHash(hash, ext)}`;
    const replacePaths = paths.filter((p) => p !== targetPath);

    if (replacePaths.length === 0) continue;

    steps.push({
      hash,
      targetPath,
      sourcePath: existingShared ?? paths[0],
      replacePaths,
    });
  }

  return steps;
}
