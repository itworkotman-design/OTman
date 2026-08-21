import type { ArchiveContextInput, ArchiveItem } from "@customprojects/custom-archive";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { archive } from "@/lib/docArchive/client";
import { getItemCodes, getFolderCodes } from "@/lib/docArchive/folderCodes";
import { getItemViewerCounts } from "@/lib/docArchive/folderStats";
import { sectionBelongsToScope } from "@/lib/docArchive/sections";
import type { ArchiveItemWithStats } from "@/lib/docArchive/withItemStats";

// A shortcut is a host-side pointer that makes a real item additionally
// *appear* in a second folder's listing — see the ArchiveItemShortcut model
// comment in schema.prisma. This is a parallel source of display rows, not a
// decoration of existing ones (unlike withItemStats.ts's isPinned flag): a
// folder's item list is the real items in it PLUS whatever shortcuts point
// into it.

export type ArchiveItemShortcutSummary = ArchiveItemWithStats & { isShortcut: true };

// Injected shortcut rows for one folder's listing. For each ArchiveItemShortcut
// row targeting this folder, resolves the live source item via the package's
// own permission-checked archive.readItem (requires `view` @ item) — a
// denial or a hard-deleted source both resolve to not-ok here and the row is
// silently dropped, never reaching the client. This matters because the
// archive package supports item-level permission rules independent of
// folder-level access: a viewer who can see the target folder must never see
// the name/description of a source item they can't otherwise view. A source
// item that's merely archived (not deleted) is still returned — FolderView
// already filters every row, real or shortcut, to `status === "active"`, so
// an archived source falls out of that existing filter with no special-casing
// needed here.
export async function listInjectedShortcuts(
  ctx: ArchiveContextInput,
  targetFolderId: string,
): Promise<ArchiveItemShortcutSummary[]> {
  const rows = await prisma.archiveItemShortcut.findMany({
    where: { companyId: ctx.companyId, tenantId: ctx.tenantId, targetFolderId },
  });
  if (rows.length === 0) return [];

  const resolved = (
    await Promise.all(
      rows.map(async (row) => {
        const itemResult = await archive.readItem(ctx, row.itemId);
        if (!itemResult.ok) return null;
        // Shortcut creation blocks pointing an item at its OWN current
        // folder (SAME_FOLDER), but that's only checked once, at creation
        // time — the item can be moved into this exact folder afterward
        // (independently, or into what used to be a different folder that
        // later became this shortcut's target), which would otherwise
        // render the same item twice: once as itself, once as a "shortcut
        // to itself". Re-checking live here, rather than trying to keep
        // shortcuts in sync with every move, means a stale shortcut just
        // stops rendering the moment it becomes redundant.
        if (itemResult.value.folderId === targetFolderId) return null;
        return { row, item: itemResult.value };
      }),
    )
  ).filter((entry): entry is { row: (typeof rows)[number]; item: ArchiveItem } => entry !== null);
  if (resolved.length === 0) return [];

  const [codes, viewerCounts] = await Promise.all([
    getItemCodes(ctx.companyId, ctx.tenantId, resolved.map(({ item }) => ({ id: item.id, folderId: item.folderId }))),
    getItemViewerCounts(ctx.companyId, ctx.tenantId, resolved.map(({ item }) => ({ id: item.id, folderId: item.folderId }))),
  ]);

  return resolved.map(({ row, item }) => ({
    ...item,
    id: row.id, // the shortcut row's OWN id — distinct React key, and what Delete/PillActions target
    folderId: targetFolderId, // where this is being listed, not the item's real folder
    code: codes.get(item.id) ?? "?", // the SOURCE item's real dotted code
    sectionId: row.sectionId, // this shortcut's own section placement in the target folder
    isPinned: false, // shortcuts are not independently pinnable
    viewerCount: viewerCounts.get(item.id) ?? 0,
    isShortcut: true as const,
  }));
}

export type CreateShortcutResult =
  | { ok: true; shortcutId: string }
  | { ok: false; reason: "ITEM_NOT_FOUND" | "FOLDER_NOT_FOUND" | "SAME_FOLDER" | "DUPLICATE" | "INVALID_SECTION" };

// The package has no native "create shortcut" primitive, so permission is
// verified explicitly: `view` on the source item (via readItem — deliberately
// NOT `edit`, since shortcutting doesn't touch the item itself) and `create`
// on the destination folder (the same bar createItem's own route enforces
// for adding anything new to a folder's listing).
export async function createItemShortcut(
  ctx: ArchiveContextInput,
  itemId: string,
  targetFolderId: string,
  sectionId: string | null,
): Promise<CreateShortcutResult> {
  const itemResult = await archive.readItem(ctx, itemId);
  if (!itemResult.ok) return { ok: false, reason: "ITEM_NOT_FOUND" };
  if (itemResult.value.folderId === targetFolderId) return { ok: false, reason: "SAME_FOLDER" };

  const capsResult = await archive.getEffectiveCapabilities(ctx, { targetType: "folder", targetId: targetFolderId });
  if (!capsResult.ok || !capsResult.value.create.allowed) return { ok: false, reason: "FOLDER_NOT_FOUND" };

  if (sectionId && !(await sectionBelongsToScope(ctx.companyId, ctx.tenantId, targetFolderId, sectionId))) {
    return { ok: false, reason: "INVALID_SECTION" };
  }

  const existing = await prisma.archiveItemShortcut.findUnique({
    where: { itemId_targetFolderId: { itemId, targetFolderId } },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "DUPLICATE" };

  // The find-then-create above isn't atomic — two concurrent requests to
  // shortcut the same item into the same folder can both pass the check
  // above and race on the (itemId, targetFolderId) unique constraint
  // (P2002). Same recovery pattern as titles.ts/spreadsheets.ts: the loser
  // just reports DUPLICATE instead of a raw 500.
  try {
    const created = await prisma.archiveItemShortcut.create({
      data: {
        companyId: ctx.companyId,
        tenantId: ctx.tenantId,
        itemId,
        targetFolderId,
        sectionId,
        createdByUserId: ctx.userId,
      },
    });
    return { ok: true, shortcutId: created.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "DUPLICATE" };
    }
    throw error;
  }
}

export type GetShortcutDetailResult =
  | { ok: true; shortcut: { id: string; targetFolderId: string; targetFolderCode: string }; item: ArchiveItemWithStats }
  | { ok: false; reason: "not_found" };

// Server-side resolution for the dedicated shortcut page — resolves both the
// source item's own real code (for its "Go to source" href) and the TARGET
// folder's own real code (for the breadcrumb) up front, so the client gets
// everything it needs in one round trip. Same not_found-for-both-denied-and-
// missing convention as every other read route in this integration.
export async function getShortcutDetail(ctx: ArchiveContextInput, shortcutId: string): Promise<GetShortcutDetailResult> {
  const row = await prisma.archiveItemShortcut.findFirst({
    where: { id: shortcutId, companyId: ctx.companyId, tenantId: ctx.tenantId },
  });
  if (!row) return { ok: false, reason: "not_found" };

  const itemResult = await archive.readItem(ctx, row.itemId);
  if (!itemResult.ok) return { ok: false, reason: "not_found" };

  const [itemCodes, targetFolderCodes] = await Promise.all([
    getItemCodes(ctx.companyId, ctx.tenantId, [{ id: itemResult.value.id, folderId: itemResult.value.folderId }]),
    getFolderCodes(ctx.companyId, ctx.tenantId, [row.targetFolderId]),
  ]);

  return {
    ok: true,
    shortcut: {
      id: row.id,
      targetFolderId: row.targetFolderId,
      targetFolderCode: targetFolderCodes.get(row.targetFolderId) ?? "?",
    },
    item: {
      ...itemResult.value,
      code: itemCodes.get(itemResult.value.id) ?? "?",
      sectionId: row.sectionId,
      isPinned: false,
      viewerCount: 0,
    },
  };
}

export type DeleteShortcutResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "FORBIDDEN" };

// requireAdmin-gated at the route level too, but that alone is only a
// company-wide "is an Archive Admin at all" bar — it does NOT account for a
// folder owner having explicitly excluded a specific Admin from their folder
// (the per-folder "Remove someone here" override in FolderSettingsView's
// Permissions tab). Without an additional check here, an excluded Admin
// could still delete a shortcut sitting in a folder they've been
// specifically denied access to. So this also requires the same `create` @
// targetFolder capability creation itself requires — symmetric with
// createItemShortcut, and the closest available capability target since a
// shortcut has no package-tracked permission entity of its own.
// Deliberately NOT gated on the caller still having `view` on the SOURCE
// item, though: if the source item's permissions changed such that a
// target-folder admin can no longer see it, they must still be able to
// remove the now-dangling shortcut from their own folder.
export async function deleteItemShortcut(ctx: ArchiveContextInput, shortcutId: string): Promise<DeleteShortcutResult> {
  const row = await prisma.archiveItemShortcut.findFirst({
    where: { id: shortcutId, companyId: ctx.companyId, tenantId: ctx.tenantId },
    select: { id: true, targetFolderId: true },
  });
  if (!row) return { ok: false, reason: "NOT_FOUND" };

  const capsResult = await archive.getEffectiveCapabilities(ctx, { targetType: "folder", targetId: row.targetFolderId });
  if (!capsResult.ok || !capsResult.value.create.allowed) return { ok: false, reason: "FORBIDDEN" };

  await prisma.archiveItemShortcut.delete({ where: { id: row.id } });
  return { ok: true };
}
