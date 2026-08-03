import type { ArchiveContextInput } from "@customprojects/custom-archive";
import { prisma } from "@/lib/db";
import { archive } from "@/lib/docArchive/client";

// Reverse of folderCodes.ts's id -> code lookups: walks a URL code path
// (e.g. ["1", "2F", "3F"], or ["1", "2F", "3F", "5"] with a trailing item
// number) down the real folder/item tree to find the id it refers to. Root
// folders are a bare number; every folder below root is numbered with an
// "F" suffix so it can't be confused with an item at the same position;
// items are always leaves and always a bare number — so a bare-number
// segment is only ever valid as the last one.
export type ResolveArchiveCodePathResult =
  | { ok: true; type: "folder"; folderId: string }
  | { ok: true; type: "item"; itemId: string; folderId: string }
  | { ok: false; reason: "not_found" };

async function findChildFolderBySeq(
  ctx: ArchiveContextInput,
  parentFolderId: string | null,
  seq: number,
): Promise<string | null> {
  const listResult = parentFolderId
    ? await archive.listChildFolders(ctx, parentFolderId)
    : await archive.listRootFolders(ctx);

  if (!listResult.ok || listResult.value.length === 0) return null;

  const match = await prisma.archiveFolderCode.findFirst({
    where: {
      companyId: ctx.companyId,
      tenantId: ctx.tenantId,
      localSeq: seq,
      folderId: { in: listResult.value.map((folder) => folder.id) },
    },
    select: { folderId: true },
  });

  return match?.folderId ?? null;
}

async function findItemBySeq(ctx: ArchiveContextInput, folderId: string, seq: number): Promise<string | null> {
  const listResult = await archive.listItemsInFolder(ctx, folderId);
  if (!listResult.ok || listResult.value.length === 0) return null;

  const match = await prisma.archiveItemCode.findFirst({
    where: {
      companyId: ctx.companyId,
      tenantId: ctx.tenantId,
      localSeq: seq,
      itemId: { in: listResult.value.map((item) => item.id) },
    },
    select: { itemId: true },
  });

  return match?.itemId ?? null;
}

export async function resolveArchiveCodePath(
  ctx: ArchiveContextInput,
  segments: string[],
): Promise<ResolveArchiveCodePathResult> {
  if (segments.length === 0) return { ok: false, reason: "not_found" };

  let currentFolderId: string | null = null;

  for (let i = 0; i < segments.length; i++) {
    const raw = segments[i];
    const isLast = i === segments.length - 1;
    const folderMatch = /^(\d+)F$/.exec(raw);
    const isRootSegment = i === 0 && /^\d+$/.test(raw);

    if (folderMatch || isRootSegment) {
      const seq = Number(folderMatch ? folderMatch[1] : raw);
      const folderId = await findChildFolderBySeq(ctx, currentFolderId, seq);
      if (!folderId) return { ok: false, reason: "not_found" };

      currentFolderId = folderId;
      if (isLast) return { ok: true, type: "folder", folderId };
      continue;
    }

    // Bare number below root: only valid as the final segment (an item).
    if (!isLast || currentFolderId === null || !/^\d+$/.test(raw)) {
      return { ok: false, reason: "not_found" };
    }

    const itemId = await findItemBySeq(ctx, currentFolderId, Number(raw));
    if (!itemId) return { ok: false, reason: "not_found" };

    return { ok: true, type: "item", itemId, folderId: currentFolderId };
  }

  return { ok: false, reason: "not_found" };
}
