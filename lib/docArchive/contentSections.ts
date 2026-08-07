import type { ArchiveContentSectionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ArchiveContentSectionRow = {
  id: string;
  type: ArchiveContentSectionType;
  position: number;
};

const DEFAULT_SECTION_TYPES: ArchiveContentSectionType[] = ["IMAGES", "FILES", "TEXT_FIELDS"];

// Position shifts must never collide mid-transaction against the
// @@unique([itemId, position]) constraint (a non-deferrable unique index),
// so every reposition goes through a large, out-of-range temporary offset
// first before landing on final sequential values — same two-phase trick as
// lib/blog/sectionPositions.ts's applySectionPositions.
const TEMP_OFFSET = 1_000_000;

async function applyContentSectionPositions(
  tx: Prisma.TransactionClient,
  orderedSectionIds: string[],
): Promise<void> {
  await Promise.all(
    orderedSectionIds.map((id, index) =>
      tx.archiveItemContentSection.update({ where: { id }, data: { position: TEMP_OFFSET + index } }),
    ),
  );
  await Promise.all(
    orderedSectionIds.map((id, index) =>
      tx.archiveItemContentSection.update({ where: { id }, data: { position: index } }),
    ),
  );
}

// Every item starts with one Images/Files/Text-fields section each (matching
// what the page always showed before sections became reorderable/addable) —
// provisioned lazily on first read rather than at item-creation time, so
// items created before this feature still get sections the first time
// they're opened. A no-op once any section exists for the item, even if the
// user has since deleted one of the three defaults.
//
// The count-then-create is not atomic, and it doesn't need to be: opening the
// same item's settings page fires several of these concurrently (the page's
// own content-sections + files fetches, sometimes doubled by React dev-mode
// double-invoking effects, occasionally a second browser tab) — several
// requests can all see `existing === 0` before any of them has committed.
// `skipDuplicates` makes the createMany itself idempotent against the
// (itemId, position) unique constraint (Postgres ON CONFLICT DO NOTHING per
// row), so whichever request's insert lands first wins and the rest no-op
// instead of throwing P2002.
export async function getOrCreateDefaultSections(
  companyId: string,
  tenantId: string,
  itemId: string,
): Promise<void> {
  const existing = await prisma.archiveItemContentSection.count({ where: { itemId } });
  if (existing > 0) return;

  await prisma.archiveItemContentSection.createMany({
    data: DEFAULT_SECTION_TYPES.map((type, position) => ({ companyId, tenantId, itemId, type, position })),
    skipDuplicates: true,
  });
}

export async function getContentSection(
  companyId: string,
  tenantId: string,
  sectionId: string,
): Promise<{ id: string; itemId: string; type: ArchiveContentSectionType } | null> {
  return prisma.archiveItemContentSection.findFirst({
    where: { id: sectionId, companyId, tenantId },
    select: { id: true, itemId: true, type: true },
  });
}

export async function listContentSections(
  companyId: string,
  tenantId: string,
  itemId: string,
): Promise<ArchiveContentSectionRow[]> {
  await getOrCreateDefaultSections(companyId, tenantId, itemId);

  return prisma.archiveItemContentSection.findMany({
    where: { companyId, tenantId, itemId },
    orderBy: { position: "asc" },
    select: { id: true, type: true, position: true },
  });
}

export async function createContentSection(
  companyId: string,
  tenantId: string,
  itemId: string,
  type: ArchiveContentSectionType,
): Promise<ArchiveContentSectionRow> {
  await getOrCreateDefaultSections(companyId, tenantId, itemId);

  const count = await prisma.archiveItemContentSection.count({ where: { itemId } });
  const section = await prisma.archiveItemContentSection.create({
    data: { companyId, tenantId, itemId, type, position: count },
  });

  return { id: section.id, type: section.type, position: section.position };
}

export type ReorderResult = { ok: true } | { ok: false; reason: "SECTION_SET_MISMATCH" };

export async function reorderContentSections(
  companyId: string,
  tenantId: string,
  itemId: string,
  orderedSectionIds: string[],
): Promise<ReorderResult> {
  const existing = await prisma.archiveItemContentSection.findMany({
    where: { companyId, tenantId, itemId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((s) => s.id));
  const requestedIds = new Set(orderedSectionIds);

  const isValidSet =
    existingIds.size === requestedIds.size && [...existingIds].every((id) => requestedIds.has(id));
  if (!isValidSet) return { ok: false, reason: "SECTION_SET_MISMATCH" };

  await prisma.$transaction((tx) => applyContentSectionPositions(tx, orderedSectionIds));
  return { ok: true };
}

export type DeleteContentSectionResult = { ok: true } | { ok: false; reason: "NOT_FOUND" };

// Deleting a section cascades (DB-level, via onDelete: Cascade) to any
// ArchiveItemTextField rows scoped to it — real content loss, which is why
// the UI requires a two-step confirm for a non-empty section, same pattern
// as BlogSectionCard's isSectionNonEmpty/confirmingDelete. An IMAGES/FILES
// section's ArchiveItemFileSection mappings cascade too, but that only
// unlinks the files — the files themselves live in the archive package's
// own storage and are untouched; they're lazily re-bucketed into another
// matching-type section (or a freshly-recreated default one) next time the
// item's files are listed, so no upload is ever actually lost.
export async function deleteContentSection(
  companyId: string,
  tenantId: string,
  sectionId: string,
): Promise<DeleteContentSectionResult> {
  const section = await prisma.archiveItemContentSection.findFirst({
    where: { id: sectionId, companyId, tenantId },
    select: { id: true, itemId: true },
  });
  if (!section) return { ok: false, reason: "NOT_FOUND" };

  await prisma.$transaction(async (tx) => {
    await tx.archiveItemContentSection.delete({ where: { id: sectionId } });

    const remaining = await tx.archiveItemContentSection.findMany({
      where: { itemId: section.itemId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    await applyContentSectionPositions(tx, remaining.map((s) => s.id));
  });

  return { ok: true };
}

export async function assignFileToSection(
  companyId: string,
  tenantId: string,
  fileId: string,
  sectionId: string,
): Promise<void> {
  await prisma.archiveItemFileSection.create({ data: { companyId, tenantId, fileId, sectionId } });
}

export async function getFileSectionMap(fileIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (fileIds.length === 0) return map;

  const rows = await prisma.archiveItemFileSection.findMany({
    where: { fileId: { in: fileIds } },
    select: { fileId: true, sectionId: true },
  });
  for (const row of rows) map.set(row.fileId, row.sectionId);
  return map;
}

// Backfills ArchiveItemFileSection rows for files uploaded before a section
// existed to hold them (either pre-dating this feature entirely, or created
// via the one shared upload flow that existed before per-section uploads).
// Each orphan is bucketed into the item's lowest-position section matching
// its own image/non-image split (mirrors the mimeType-based Images/Files
// split the page already used before sections existed) — auto-provisioning
// the default sections first if the item somehow has none.
export async function assignOrphanFiles(
  companyId: string,
  tenantId: string,
  itemId: string,
  files: { id: string; mimeType: string }[],
): Promise<Map<string, string>> {
  const map = await getFileSectionMap(files.map((f) => f.id));
  const orphans = files.filter((f) => !map.has(f.id));
  if (orphans.length === 0) return map;

  await getOrCreateDefaultSections(companyId, tenantId, itemId);
  const sections = await prisma.archiveItemContentSection.findMany({
    where: { itemId, type: { in: ["IMAGES", "FILES"] } },
    orderBy: { position: "asc" },
    select: { id: true, type: true },
  });

  const firstImagesSection = sections.find((s) => s.type === "IMAGES");
  const firstFilesSection = sections.find((s) => s.type === "FILES");

  const creates: { fileId: string; sectionId: string }[] = [];
  for (const file of orphans) {
    const target = file.mimeType.startsWith("image/") ? firstImagesSection : firstFilesSection;
    if (!target) continue;
    creates.push({ fileId: file.id, sectionId: target.id });
    map.set(file.id, target.id);
  }

  if (creates.length > 0) {
    await prisma.archiveItemFileSection.createMany({
      data: creates.map((c) => ({ companyId, tenantId, fileId: c.fileId, sectionId: c.sectionId })),
      skipDuplicates: true,
    });
  }

  return map;
}
