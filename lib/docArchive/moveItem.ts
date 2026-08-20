import type { ArchiveContextInput } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { reassignItemCode } from "@/lib/docArchive/folderCodes";
import { sectionBelongsToScope } from "@/lib/docArchive/sections";

// The package's own moveItem (added in the 0.2.0 delivery — see
// custom-archive-backend-feedback.md #3, now resolved upstream) handles the
// actual move: requires `edit` on the item and `create` on the destination
// folder, enforces the archived-status guard on both ends, and is a true
// no-op (no event, unchanged row) when the destination equals the current
// folder. This file now only adds what the package still doesn't know
// about: the host-side display-code bookkeeping and section placement.
export type MoveItemResult =
  | { ok: true }
  | { ok: false; reason: "ITEM_NOT_FOUND" | "DESTINATION_NOT_FOUND" | "SAME_FOLDER" | "INVALID_SECTION" };

// destinationSectionId is optional — the mover can either pick a real
// section inside the destination folder (validated the same way createItem's
// route does, via sectionBelongsToScope) or pass null to land the item in
// the destination folder's "Ungrouped" bucket, same as creating an item
// there directly without a section would.
export async function moveItemToFolder(
  ctx: ArchiveContextInput,
  itemId: string,
  destinationFolderId: string,
  destinationSectionId: string | null,
): Promise<MoveItemResult> {
  const itemResult = await archive.readItem(ctx, itemId);
  if (!itemResult.ok) return { ok: false, reason: "ITEM_NOT_FOUND" };
  if (itemResult.value.folderId === destinationFolderId) return { ok: false, reason: "SAME_FOLDER" };

  if (destinationSectionId) {
    const validSection = await sectionBelongsToScope(ctx.companyId, ctx.tenantId, destinationFolderId, destinationSectionId);
    if (!validSection) return { ok: false, reason: "INVALID_SECTION" };
  }

  const moveResult = await archive.moveItem(ctx, itemId, { folderId: destinationFolderId });
  // Denials never leak in this package (unauthorized/archived-guard failures
  // and a genuinely missing destination both surface as the same category
  // here) — mapped to DESTINATION_NOT_FOUND like every other route in this
  // integration, matching the established not_found convention.
  if (!moveResult.ok) return { ok: false, reason: "DESTINATION_NOT_FOUND" };

  await reassignItemCode(ctx.companyId, ctx.tenantId, itemId, destinationFolderId, destinationSectionId);

  return { ok: true };
}
