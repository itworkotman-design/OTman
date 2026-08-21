import { prisma } from "@/lib/db";
import { archivePrisma } from "@/lib/docArchive/client";
import { ROOT_SCOPE } from "@/lib/docArchive/folderCodes";

export type ArchiveSectionRow = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  folderCount: number;
  itemCount: number;
};

// parentFolderId null means the archive root's own section scope (a
// company's top-level folders) — normalized to the same ROOT_SCOPE sentinel
// ArchiveSequenceCounter/ArchiveFolderCode use elsewhere, since a nullable
// column would defeat scoping by parent (Postgres treats every NULL as
// distinct).
function scopeKey(parentFolderId: string | null): string {
  return parentFolderId ?? ROOT_SCOPE;
}

// `archivePrisma` is typed as the package's narrow internal
// `PrismaArchiveHostAdapterClient` contract, not a general query client, but
// at runtime it's a real generated PrismaClient — same local-type-cast
// workaround as folderStats.ts/runArchiveRetentionSweep.ts, scoped to the one
// query below.
type ArchiveLivenessQueryClient = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
};

const archiveDb = archivePrisma as unknown as ArchiveLivenessQueryClient;

// ArchiveFolderCode/ArchiveItemCode rows are permanent by design — assigned
// once at creation, never removed even after the folder/item they reference
// is (soft-)deleted in the separate archive package database, since display
// codes must never be reused. That makes `_count.folderCodes`/`_count.itemCodes`
// count *everything ever placed in a section*, not what's there now — a
// section that once held one item that was later deleted would look
// permanently "non-empty" forever. This resolves the id lists against the
// live (non-deleted) archive_folders/archive_items tables instead, so
// "empty" reflects the section's actual current contents.
async function getLiveSectionCounts(
  companyId: string,
  tenantId: string,
  sectionIds: string[],
): Promise<Map<string, { folderCount: number; itemCount: number }>> {
  const counts = new Map<string, { folderCount: number; itemCount: number }>();
  for (const sectionId of sectionIds) counts.set(sectionId, { folderCount: 0, itemCount: 0 });
  if (sectionIds.length === 0) return counts;

  const [folderCodeRows, itemCodeRows, shortcutRows] = await Promise.all([
    prisma.archiveFolderCode.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { sectionId: true, folderId: true },
    }),
    prisma.archiveItemCode.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { sectionId: true, itemId: true },
    }),
    // A shortcut occupies a section slot too — without this, a section
    // holding only shortcuts (no real items/folders) would report itemCount
    // 0 and pass deleteSection's "NOT_EMPTY" guard, silently orphaning the
    // shortcut's sectionId (FK is ON DELETE SET NULL) the moment the section
    // is deleted, even though the shortcut pill is still visibly rendered
    // under it.
    prisma.archiveItemShortcut.findMany({
      where: { sectionId: { in: sectionIds } },
      select: { sectionId: true, itemId: true },
    }),
  ]);

  const folderIds = folderCodeRows.map((row) => row.folderId);
  // Shortcuts share the same itemIds address space as real items, and are
  // resolved against the same live-items lookup below — a shortcut whose
  // source item was since (soft-)deleted is already invisible everywhere
  // (see listInjectedShortcuts), so it shouldn't count as "occupying" the
  // section either, same as a deleted real item's stale ArchiveItemCode row.
  const itemIds = [...new Set([...itemCodeRows.map((row) => row.itemId), ...shortcutRows.map((row) => row.itemId)])];

  const [liveFolderRows, liveItemRows] = await Promise.all([
    folderIds.length > 0
      ? archiveDb.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" AS "id" FROM archive."archive_folders" WHERE "companyId" = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL AND "id" = ANY($3::uuid[])`,
          companyId,
          tenantId,
          folderIds,
        )
      : Promise.resolve([] as { id: string }[]),
    itemIds.length > 0
      ? archiveDb.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" AS "id" FROM archive."archive_items" WHERE "companyId" = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL AND "id" = ANY($3::uuid[])`,
          companyId,
          tenantId,
          itemIds,
        )
      : Promise.resolve([] as { id: string }[]),
  ]);

  const liveFolderIds = new Set(liveFolderRows.map((row) => row.id));
  const liveItemIds = new Set(liveItemRows.map((row) => row.id));

  for (const row of folderCodeRows) {
    if (!row.sectionId || !liveFolderIds.has(row.folderId)) continue;
    const entry = counts.get(row.sectionId);
    if (entry) entry.folderCount += 1;
  }
  for (const row of itemCodeRows) {
    if (!row.sectionId || !liveItemIds.has(row.itemId)) continue;
    const entry = counts.get(row.sectionId);
    if (entry) entry.itemCount += 1;
  }
  for (const row of shortcutRows) {
    if (!row.sectionId || !liveItemIds.has(row.itemId)) continue;
    const entry = counts.get(row.sectionId);
    if (entry) entry.itemCount += 1;
  }

  return counts;
}

export async function listSections(
  companyId: string,
  tenantId: string,
  parentFolderId: string | null,
): Promise<ArchiveSectionRow[]> {
  const sections = await prisma.archiveSection.findMany({
    where: { companyId, tenantId, parentFolderId: scopeKey(parentFolderId) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const liveCounts = await getLiveSectionCounts(
    companyId,
    tenantId,
    sections.map((section) => section.id),
  );

  return sections.map((section) => {
    const counts = liveCounts.get(section.id) ?? { folderCount: 0, itemCount: 0 };
    return {
      id: section.id,
      name: section.name,
      description: section.description,
      order: section.order,
      folderCount: counts.folderCount,
      itemCount: counts.itemCount,
    };
  });
}

export type RenameSectionResult = { ok: true; section: ArchiveSectionRow } | { ok: false; reason: "NOT_FOUND" };

export async function renameSection(
  companyId: string,
  tenantId: string,
  sectionId: string,
  name: string,
  description: string | null,
): Promise<RenameSectionResult> {
  const existing = await prisma.archiveSection.findFirst({
    where: { id: sectionId, companyId, tenantId },
    select: { id: true },
  });
  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  const section = await prisma.archiveSection.update({
    where: { id: sectionId },
    data: { name, description },
  });

  const liveCounts = await getLiveSectionCounts(companyId, tenantId, [sectionId]);
  const counts = liveCounts.get(sectionId) ?? { folderCount: 0, itemCount: 0 };

  return {
    ok: true,
    section: {
      id: section.id,
      name: section.name,
      description: section.description,
      order: section.order,
      folderCount: counts.folderCount,
      itemCount: counts.itemCount,
    },
  };
}

export async function createSection(
  companyId: string,
  tenantId: string,
  parentFolderId: string | null,
  name: string,
  description: string | null,
): Promise<ArchiveSectionRow> {
  const lastSection = await prisma.archiveSection.findFirst({
    where: { companyId, tenantId, parentFolderId: scopeKey(parentFolderId) },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const section = await prisma.archiveSection.create({
    data: {
      companyId,
      tenantId,
      parentFolderId: scopeKey(parentFolderId),
      name,
      description,
      order: (lastSection?.order ?? -1) + 1,
    },
  });

  return { id: section.id, name: section.name, description: section.description, order: section.order, folderCount: 0, itemCount: 0 };
}

export type DeleteSectionResult = { ok: true } | { ok: false; reason: "NOT_EMPTY" | "NOT_FOUND" };

// Sections are deleted outright rather than soft-deleted (unlike Archive's
// own folders/items) — they're a purely host-side organizational label, not
// content, so there's nothing to recover. Only allowed when empty: the FK on
// ArchiveFolderCode/ArchiveItemCode.sectionId is ON DELETE SET NULL as a
// defensive fallback, but this check gives a real error instead of silently
// scattering a section's contents back to "ungrouped". Emptiness is judged
// against *live* (non-deleted) folders/items via getLiveSectionCounts, not
// the permanent ArchiveFolderCode/ArchiveItemCode row counts — those rows
// never shrink even after their folder/item is deleted, which would
// otherwise make a section that once held anything permanently undeletable.
export async function deleteSection(
  companyId: string,
  tenantId: string,
  sectionId: string,
): Promise<DeleteSectionResult> {
  const section = await prisma.archiveSection.findFirst({
    where: { id: sectionId, companyId, tenantId },
    select: { id: true },
  });

  if (!section) return { ok: false, reason: "NOT_FOUND" };

  const liveCounts = await getLiveSectionCounts(companyId, tenantId, [sectionId]);
  const counts = liveCounts.get(sectionId) ?? { folderCount: 0, itemCount: 0 };
  if (counts.folderCount > 0 || counts.itemCount > 0) {
    return { ok: false, reason: "NOT_EMPTY" };
  }

  await prisma.archiveSection.delete({ where: { id: sectionId } });
  return { ok: true };
}

export type MoveResult = { ok: true } | { ok: false; reason: "INVALID_SECTION" };

// Validates the target section belongs to the same (companyId, tenantId,
// parentFolderId) scope as the folder/item being moved before repointing
// its ArchiveFolderCode/ArchiveItemCode row — otherwise a folder could end
// up "in" a section that lives under a different parent folder entirely.
export async function moveFolderToSection(
  companyId: string,
  tenantId: string,
  folderId: string,
  parentFolderId: string | null,
  sectionId: string,
): Promise<MoveResult> {
  const section = await prisma.archiveSection.findFirst({
    where: { id: sectionId, companyId, tenantId, parentFolderId: scopeKey(parentFolderId) },
    select: { id: true },
  });
  if (!section) return { ok: false, reason: "INVALID_SECTION" };

  await prisma.archiveFolderCode.update({ where: { folderId }, data: { sectionId } });
  return { ok: true };
}

export async function moveItemToSection(
  companyId: string,
  tenantId: string,
  itemId: string,
  containingFolderId: string,
  sectionId: string,
): Promise<MoveResult> {
  const section = await prisma.archiveSection.findFirst({
    where: { id: sectionId, companyId, tenantId, parentFolderId: containingFolderId },
    select: { id: true },
  });
  if (!section) return { ok: false, reason: "INVALID_SECTION" };

  await prisma.archiveItemCode.update({ where: { itemId }, data: { sectionId } });
  return { ok: true };
}

// Confirms a sectionId a client sent when creating a subfolder/item really
// belongs to the scope it's being created in, before assignFolderCode/
// assignItemCode ever runs — prevents cross-scope section ids sneaking in
// through the create routes.
export async function sectionBelongsToScope(
  companyId: string,
  tenantId: string,
  parentFolderId: string | null,
  sectionId: string,
): Promise<boolean> {
  const section = await prisma.archiveSection.findFirst({
    where: { id: sectionId, companyId, tenantId, parentFolderId: scopeKey(parentFolderId) },
    select: { id: true },
  });
  return section !== null;
}
