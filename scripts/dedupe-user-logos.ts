import "./_loadScriptEnv";
import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "../lib/db";
import {
  deleteAttachmentFile,
  downloadAttachmentFromS3,
  isS3StoragePath,
  putAttachmentObjectToS3,
} from "../lib/orders/orderAttachmentStorage";
import { normalizeUserLogoPath } from "../lib/users/profileAppearance";
import { hashUserLogoBytes, planUserLogoDedupe } from "../lib/users/sharedUserLogo";

// Collapses duplicate user logos (the same picture uploaded several times,
// each under its own S3 key) onto one content-addressed shared file, repoints
// every User/Invite to it and deletes the leftover copies. Afterwards
// "Previously used pictures" shows each picture once, and new uploads of the
// same picture land on the same path (see app/api/auth/users/logo/route.ts).
//
// Dry run by default; pass --apply to write. Uses .env + .env.local like the
// dev server; pass --prod to use .env only (production).
//   tsx scripts/dedupe-user-logos.ts                  # show the plan
//   tsx scripts/dedupe-user-logos.ts --apply          # do it
//   tsx scripts/dedupe-user-logos.ts --prod [--apply] # against production
//
// Only byte-identical files are merged; the plan lists each distinct
// picture with its copies so near-duplicates (e.g. a resized re-upload)
// are visible.

const apply = process.argv.includes("--apply");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

async function readLogoBytes(logoPath: string): Promise<Buffer | null> {
  if (isS3StoragePath(logoPath)) {
    const file = await downloadAttachmentFromS3(logoPath).catch(() => null);
    return file?.bytes ?? null;
  }

  const absolutePath = path.join(process.cwd(), "public", logoPath.replace(/^\//, ""));
  return readFile(absolutePath).catch(() => null);
}

async function main() {
  const dbHost = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "(unparseable DATABASE_URL)";
    }
  })();
  console.log(`Database: ${dbHost}`);
  console.log(`S3 bucket: ${process.env.S3_BUCKET ?? "(not set)"}`);
  console.log(apply ? "Mode: APPLY\n" : "Mode: dry run (pass --apply to write)\n");

  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      where: { logoPath: { not: null } },
      select: { logoPath: true },
      distinct: ["logoPath"],
    }),
    prisma.invite.findMany({
      where: { logoPath: { not: null } },
      select: { logoPath: true },
      distinct: ["logoPath"],
    }),
  ]);

  const logoPaths = [
    ...new Set(
      [...users, ...invites]
        .map(({ logoPath }) => normalizeUserLogoPath(logoPath))
        .filter((p): p is string => p !== null),
    ),
  ];

  const entries: Array<{ logoPath: string; hash: string }> = [];
  const bytesByPath = new Map<string, Buffer>();
  for (const logoPath of logoPaths) {
    const bytes = await readLogoBytes(logoPath);
    if (!bytes) {
      console.warn(`  ! could not read ${logoPath} — left untouched`);
      continue;
    }
    bytesByPath.set(logoPath, bytes);
    entries.push({ logoPath, hash: hashUserLogoBytes(bytes) });
  }

  const plan = planUserLogoDedupe(entries);
  const distinctPictures = new Set(entries.map((e) => e.hash)).size;
  console.log(
    `${logoPaths.length} logo paths in use, ${distinctPictures} distinct pictures, ${plan.length} to consolidate.\n`,
  );

  for (const step of plan) {
    const userCount = await prisma.user.count({
      where: { logoPath: { in: step.replacePaths } },
    });
    const inviteCount = await prisma.invite.count({
      where: { logoPath: { in: step.replacePaths } },
    });
    console.log(`${step.targetPath}`);
    console.log(`  ← ${step.replacePaths.length} old path(s), ${userCount} user(s), ${inviteCount} invite(s)`);
    for (const oldPath of step.replacePaths) {
      console.log(`     ${oldPath.split("/").pop()} (${bytesByPath.get(oldPath)?.length ?? "?"} bytes)`);
    }

    if (!apply) continue;

    if (step.sourcePath !== step.targetPath) {
      const bytes = bytesByPath.get(step.sourcePath);
      if (!bytes) continue;
      const ext = path.extname(step.targetPath).toLowerCase();
      await putAttachmentObjectToS3({
        key: step.targetPath.replace(/^s3:\/\//, ""),
        bytes,
        contentType: CONTENT_TYPES[ext] ?? null,
      });
    }

    await prisma.user.updateMany({
      where: { logoPath: { in: step.replacePaths } },
      data: { logoPath: step.targetPath },
    });
    await prisma.invite.updateMany({
      where: { logoPath: { in: step.replacePaths } },
      data: { logoPath: step.targetPath },
    });

    for (const oldPath of step.replacePaths) {
      await deleteAttachmentFile(oldPath);
    }
  }

  console.log(apply ? "\nDone." : "\nDry run only — nothing was changed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
