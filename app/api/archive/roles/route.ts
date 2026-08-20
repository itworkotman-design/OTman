import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext, ensureNamespaceManager } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";
import { getArchiveTenantRoleIds } from "@/lib/docArchive/tenantRoles";

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const ctx = buildArchiveContext(result.session, result.membership);
  await ensureNamespaceManager(ctx, result.membership.role);
  const listResult = await archive.listArchiveRoles(ctx);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  // The tenant's two durable "Admin"/"Viewer" system roles (see
  // lib/docArchive/tenantRoles.ts) back the default company-wide access
  // cascade — they're not user-created folder-sharing groups, so they're
  // excluded from every user-facing roles list (this GET backs both the
  // Roles management UI and the folder Sharing panel's "Gruppe" picker).
  const systemRoleIds = await getArchiveTenantRoleIds(result.membership.companyId);
  const roles = systemRoleIds
    ? listResult.value.filter((role) => role.id !== systemRoleIds.adminRoleId && role.id !== systemRoleIds.viewerRoleId)
    : listResult.value;

  return NextResponse.json({ ok: true, roles });
}

export async function POST(req: Request) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { session, membership } = result;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const ctx = buildArchiveContext(session, membership);
  await ensureNamespaceManager(ctx, membership.role);

  const createResult = await archive.createArchiveRole(ctx, { name });

  if (!createResult.ok) {
    return NextResponse.json(
      { ok: false, reason: createResult.error.category, message: createResult.error.message },
      { status: archiveErrorStatus(createResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, role: createResult.value }, { status: 201 });
}
