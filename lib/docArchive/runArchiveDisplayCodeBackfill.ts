import { archivePrisma } from "@/lib/docArchive/client";
import { prisma } from "@/lib/db";
import { assignFolderCode, assignItemCode } from "@/lib/docArchive/folderCodes";

export type ArchiveDisplayCodeBackfillSummary = {
  foldersTotal: number;
  foldersBackfilled: number;
  itemsTotal: number;
  itemsBackfilled: number;
};

// One-time (but idempotent — safe to re-run) backfill for
// lib/docArchive/folderCodes.ts: assigns display codes to every
// folder/item that existed before that feature shipped (they have no
// ArchiveFolderCode/ArchiveItemCode row yet). Exposed as a cron-secret-gated
// route (app/api/cron/archive-backfill-display-codes/route.ts) rather than a
// local script, following the same runArchiveRetentionSweep.ts pattern —
// this needs to run once against every environment's real database (this
// repo's local dev DB included), and a plain `tsx` script can't: tsx loads
// .ts files as CommonJS by default (no "type": "module" in package.json),
// and @customprojects/custom-archive's package.json exposes only an "import"
// condition — `require()`-based resolution of it fails
// (ERR_PACKAGE_PATH_NOT_EXPORTED) even though this exact code runs fine
// under Next.js's own bundler, confirmed empirically.
//
// Assigns in global createdAt order, which is sufficient (not just
// convenient): each parent/folder has its own independent counter, so a
// globally-sorted pass naturally preserves each counter's own creation
// order too.
//
// `archivePrisma` is typed as the package's narrow internal
// `PrismaArchiveHostAdapterClient` contract; this local type is the same
// scoped-cast workaround as runArchiveRetentionSweep.ts / folderStats.ts.
type BackfillQueryClient = {
  archiveFolder: {
    findMany(args: {
      where: { deletedAt: null };
      select: { id: true; companyId: true; tenantId: true; parentFolderId: true; createdAt: true };
      orderBy: { createdAt: "asc" };
    }): Promise<{ id: string; companyId: string; tenantId: string; parentFolderId: string | null; createdAt: Date }[]>;
  };
  archiveItem: {
    findMany(args: {
      where: { deletedAt: null };
      select: { id: true; companyId: true; tenantId: true; folderId: true; createdAt: true };
      orderBy: { createdAt: "asc" };
    }): Promise<{ id: string; companyId: string; tenantId: string; folderId: string; createdAt: Date }[]>;
  };
};

const db = archivePrisma as unknown as BackfillQueryClient;

// Only ever-live (never-deleted) folders/items are backfilled — anything
// already soft-deleted before this feature existed never had a code while
// alive, and retroactively minting one now would waste low, user-visible
// numbers (e.g. root "1"/"2") on content nobody can see, pushing real
// content's numbering to start higher than it should. Contrast the live
// creation path (assignFolderCode/assignItemCode called from the
// create-folder/create-item routes): a folder assigned a code while alive
// keeps it forever even if deleted afterward — that's the intended
// "deleting something doesn't renumber its siblings" behavior. This is
// different: these rows were deleted before the numbering system existed.
async function backfillFolders(): Promise<{ total: number; backfilled: number }> {
  const [folders, existing] = await Promise.all([
    db.archiveFolder.findMany({
      where: { deletedAt: null },
      select: { id: true, companyId: true, tenantId: true, parentFolderId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.archiveFolderCode.findMany({ select: { folderId: true } }),
  ]);

  const alreadyCoded = new Set(existing.map((row) => row.folderId));
  const missing = folders.filter((folder) => !alreadyCoded.has(folder.id));

  for (const folder of missing) {
    await assignFolderCode(folder.companyId, folder.tenantId, folder.id, folder.parentFolderId, null);
  }

  return { total: folders.length, backfilled: missing.length };
}

async function backfillItems(): Promise<{ total: number; backfilled: number }> {
  const [items, existing] = await Promise.all([
    db.archiveItem.findMany({
      where: { deletedAt: null },
      select: { id: true, companyId: true, tenantId: true, folderId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.archiveItemCode.findMany({ select: { itemId: true } }),
  ]);

  const alreadyCoded = new Set(existing.map((row) => row.itemId));
  const missing = items.filter((item) => !alreadyCoded.has(item.id));

  for (const item of missing) {
    await assignItemCode(item.companyId, item.tenantId, item.id, item.folderId, null);
  }

  return { total: items.length, backfilled: missing.length };
}

export async function runArchiveDisplayCodeBackfill(): Promise<ArchiveDisplayCodeBackfillSummary> {
  const folderResult = await backfillFolders();
  const itemResult = await backfillItems();

  return {
    foldersTotal: folderResult.total,
    foldersBackfilled: folderResult.backfilled,
    itemsTotal: itemResult.total,
    itemsBackfilled: itemResult.backfilled,
  };
}
