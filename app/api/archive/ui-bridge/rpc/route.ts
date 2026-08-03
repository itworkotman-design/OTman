import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext, ensureNamespaceBootstrapped } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";

// The exact `ArchiveUiServiceMethodName` union from the college's vendored
// archive-ui bridge contract (lib/archiveUi/vendor/bridge.tsx) — this is the
// full set of read/write host-adapter methods their UI screens are allowed
// to call. Kept as a literal allow-list (not "whatever the client sends") so
// this generic dispatcher can never be used to invoke a method the UI
// package itself wasn't scoped to use (e.g. the system-only
// bootstrapNamespacePermissions/reconcileStorageOperations/purgeFile, or
// upload/download, which travel through the separate transport routes).
const ALLOWED_METHODS = new Set([
  "assignArchiveRole",
  "createArchiveRole",
  "createFolder",
  "createItem",
  "deleteArchiveRole",
  "explainPermissions",
  "getEffectiveCapabilities",
  "getFolderPath",
  "listArchiveRoleAssignmentsForRole",
  "listArchiveRoles",
  "listChildFolders",
  "listFilesForItem",
  "listItemsInFolder",
  "listPermissionHistory",
  "listPermissionRules",
  "listRecoverableContent",
  "listRecoverableFilesForItem",
  "listResourceHistory",
  "listRootFolders",
  "readFolder",
  "readItem",
  "renameArchiveRole",
  "restoreFile",
  "restoreFolder",
  "restoreItem",
  "revokePermissionRule",
  "searchFolders",
  "searchItems",
  "setFolderDates",
  "setFolderStatus",
  "setItemDates",
  "setItemStatus",
  "setPermissionRule",
  "softDeleteFile",
  "softDeleteFolder",
  "softDeleteItem",
  "unassignArchiveRole",
]);

type ArchiveMethodMap = Record<
  string,
  (...args: unknown[]) => Promise<unknown>
>;

export async function POST(req: Request) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const body = await req.json().catch(() => null);
  const method = typeof body?.method === "string" ? body.method : "";
  const args = Array.isArray(body?.args) ? body.args : [];

  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  // The client-supplied `ArchiveContextInput` is never trusted — it exists
  // only so the archive-ui screens have something to read/pass around
  // locally. The real context is always re-derived from the session cookie,
  // same as every other route in this integration.
  const ctx = buildArchiveContext(result.session, result.membership);

  // Bootstrap is genuine host infrastructure (INTEGRATION.md #9: a system
  // operation Archive never gates itself, the host must restrict/trigger it)
  // — without it every method call on a brand-new tenant fails outright, so
  // it's applied here same as the production folders route. Deliberately NOT
  // applied: `grantFolderCreatorCapabilities` (our OTman-specific workaround
  // for the `createFolder` auto-grant gap logged in the feedback doc). This
  // lab calls the raw host-adapter surface as-is, so creating a folder here
  // reproduces that real gap — see custom-archive-backend-feedback.md.
  const isRootFolderCreate =
    method === "createFolder" &&
    !(args[0] as { parentFolderId?: unknown } | undefined)?.parentFolderId;
  if (isRootFolderCreate) {
    await ensureNamespaceBootstrapped(ctx, result.membership.role);
  }

  const fn = (archive as unknown as ArchiveMethodMap)[method];
  const value = await fn(ctx, ...args);

  return NextResponse.json(value);
}
