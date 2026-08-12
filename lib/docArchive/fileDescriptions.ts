import { prisma } from "@/lib/db";

// Host-side per-file description text — see the ArchiveFileDescription model
// comment in schema.prisma. Keyed by the archive package's opaque fileId, one
// row per file at most (no row at all means "no description yet", not an
// empty string — setFileDescription deletes the row instead of storing "").
export async function getFileDescriptionsMap(fileIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (fileIds.length === 0) return map;

  const rows = await prisma.archiveFileDescription.findMany({
    where: { fileId: { in: fileIds } },
    select: { fileId: true, description: true },
  });
  for (const row of rows) map.set(row.fileId, row.description);
  return map;
}

export async function setFileDescription(
  companyId: string,
  tenantId: string,
  fileId: string,
  description: string,
): Promise<string | null> {
  const trimmed = description.trim();

  if (trimmed.length === 0) {
    await prisma.archiveFileDescription.deleteMany({ where: { companyId, tenantId, fileId } });
    return null;
  }

  const row = await prisma.archiveFileDescription.upsert({
    where: { fileId },
    create: { companyId, tenantId, fileId, description: trimmed },
    update: { description: trimmed },
  });
  return row.description;
}
