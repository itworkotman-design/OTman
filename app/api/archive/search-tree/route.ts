import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { searchArchiveTree } from "@/lib/docArchive/searchArchiveTree";

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  const scopeFolderId = url.searchParams.get("scope")?.trim() || null;

  const ctx = buildArchiveContext(result.session, result.membership);
  const results = await searchArchiveTree(ctx.companyId, ctx.tenantId, ctx.userId, scopeFolderId, query);

  return NextResponse.json({ ok: true, results });
}
