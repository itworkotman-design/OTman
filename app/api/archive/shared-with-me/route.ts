import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { listDirectlyGrantedTargets } from "@/lib/docArchive/sharedWithMe";
import { withFolderStats } from "@/lib/docArchive/withFolderStats";
import { withItemStats } from "@/lib/docArchive/withItemStats";

// Folders/items the caller has a direct permission grant on, regardless of
// whether they can see any of the folder's ancestors — see
// lib/docArchive/sharedWithMe.ts for why this can't just be a filtered
// listChildFolders/listRootFolders call. readFolder/readItem re-check each
// candidate through the package's own authoritative chain-walk (not just
// listDirectlyGrantedTargets' own precedence logic) before it's returned, so
// a bug in the latter can only under-include, never leak something the real
// engine would deny.
export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { session, membership } = result;
  const ctx = buildArchiveContext(session, membership);

  const { folderIds, itemIds } = await listDirectlyGrantedTargets(ctx.companyId, ctx.tenantId, ctx.userId);

  const [folderResults, itemResults] = await Promise.all([
    Promise.all(folderIds.map((id) => archive.readFolder(ctx, id))),
    Promise.all(itemIds.map((id) => archive.readItem(ctx, id))),
  ]);

  const folders = folderResults.filter((r) => r.ok).map((r) => r.value);
  const items = itemResults.filter((r) => r.ok).map((r) => r.value);

  const [foldersWithStats, itemsWithStats] = await Promise.all([
    withFolderStats(ctx, folders),
    withItemStats(ctx, items),
  ]);

  return NextResponse.json({ ok: true, folders: foldersWithStats, items: itemsWithStats });
}
