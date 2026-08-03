import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { createSection, listSections } from "@/lib/docArchive/sections";

// Sections defined directly inside this folder's own settings page — the
// grouping subfolders/items created here (per the create routes' now-
// mandatory sectionId) are organized into.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const ctx = buildArchiveContext(result.session, result.membership);
  const sections = await listSections(ctx.companyId, ctx.tenantId, folderId);

  return NextResponse.json({ ok: true, sections });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { session, membership } = result;
  const { folderId } = await params;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const ctx = buildArchiveContext(session, membership);
  const section = await createSection(ctx.companyId, ctx.tenantId, folderId, name, description);

  return NextResponse.json({ ok: true, section }, { status: 201 });
}
