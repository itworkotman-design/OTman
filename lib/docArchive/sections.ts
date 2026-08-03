import { prisma } from "@/lib/db";
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

export async function listSections(
  companyId: string,
  tenantId: string,
  parentFolderId: string | null,
): Promise<ArchiveSectionRow[]> {
  const sections = await prisma.archiveSection.findMany({
    where: { companyId, tenantId, parentFolderId: scopeKey(parentFolderId) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { folderCodes: true, itemCodes: true } } },
  });

  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    description: section.description,
    order: section.order,
    folderCount: section._count.folderCodes,
    itemCount: section._count.itemCodes,
  }));
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
// scattering a section's contents back to "ungrouped".
export async function deleteSection(
  companyId: string,
  tenantId: string,
  sectionId: string,
): Promise<DeleteSectionResult> {
  const section = await prisma.archiveSection.findFirst({
    where: { id: sectionId, companyId, tenantId },
    include: { _count: { select: { folderCodes: true, itemCodes: true } } },
  });

  if (!section) return { ok: false, reason: "NOT_FOUND" };
  if (section._count.folderCodes > 0 || section._count.itemCodes > 0) {
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
