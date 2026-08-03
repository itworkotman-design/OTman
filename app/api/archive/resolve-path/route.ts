import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { resolveArchiveCodePath } from "@/lib/docArchive/resolveCodePath";

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const url = new URL(req.url);
  const segments = (url.searchParams.get("path") ?? "").split("/").filter(Boolean);

  const ctx = buildArchiveContext(result.session, result.membership);
  const resolved = await resolveArchiveCodePath(ctx, segments);

  if (!resolved.ok) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(resolved);
}
