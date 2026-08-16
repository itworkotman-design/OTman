import type { ArchiveContextInput } from "@customprojects/custom-archive";
import { archive } from "@/lib/docArchive/client";
import { reassignFolderCode } from "@/lib/docArchive/folderCodes";
import { sectionBelongsToScope } from "@/lib/docArchive/sections";

// The package's own moveFolder (added in the 0.2.0 delivery — see
// custom-archive-backend-feedback.md #3, now resolved upstream) handles the
// actual move, including cycle-safety: it rejects moving a folder under
// itself or one of its own descendants with a validation-category error
// (message contains "descendants"). This file now only adds what the
// package still doesn't know about: the host-side display-code bookkeeping
// and section placement.
//
// Moving to the archive root stays deliberately unsupported here (see the
// git history for the earlier invisible-folder bug this caused) —
// destinationFolderId is a plain required string, not nullable, even though
// the package's own moveFolder does accept `parentFolderId: null`.
export type MoveFolderResult =
  | { ok: true }
  | { ok: false; reason: "FOLDER_NOT_FOUND" | "DESTINATION_NOT_FOUND" | "SAME_FOLDER" | "CYCLE" | "INVALID_SECTION" };

// destinationSectionId is required (not defaulted to "ungrouped") — same
// reasoning as moveItemToFolder: the mover always picks a real section
// inside the destination folder, validated via sectionBelongsToScope before
// anything is written.
export async function moveFolderToFolder(
  ctx: ArchiveContextInput,
  folderId: string,
  destinationFolderId: string,
  destinationSectionId: string,
): Promise<MoveFolderResult> {
  const folderResult = await archive.readFolder(ctx, folderId);
  if (!folderResult.ok) return { ok: false, reason: "FOLDER_NOT_FOUND" };

  const currentParentId = folderResult.value.parentFolderId ?? null;
  if (currentParentId === destinationFolderId) return { ok: false, reason: "SAME_FOLDER" };
  if (destinationFolderId === folderId) return { ok: false, reason: "CYCLE" };

  const validSection = await sectionBelongsToScope(ctx.companyId, ctx.tenantId, destinationFolderId, destinationSectionId);
  if (!validSection) return { ok: false, reason: "INVALID_SECTION" };

  const moveResult = await archive.moveFolder(ctx, folderId, { parentFolderId: destinationFolderId });
  if (!moveResult.ok) {
    if (moveResult.error.category === "validation") return { ok: false, reason: "CYCLE" };
    // Denials never leak in this package (unauthorized/archived-guard
    // failures and a genuinely missing destination both surface here) —
    // mapped to DESTINATION_NOT_FOUND like every other route in this
    // integration, matching the established not_found convention.
    return { ok: false, reason: "DESTINATION_NOT_FOUND" };
  }

  await reassignFolderCode(ctx.companyId, ctx.tenantId, folderId, destinationFolderId, destinationSectionId);

  return { ok: true };
}
