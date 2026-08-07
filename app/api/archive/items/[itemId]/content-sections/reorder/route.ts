import { NextResponse } from "next/server";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { reorderContentSections } from "@/lib/docArchive/contentSections";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { itemId } = await params;
  const body = await req.json().catch(() => null);

  if (!Array.isArray(body) || !body.every((entry) => typeof entry?.id === "string" && typeof entry?.position === "number")) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const orderedIds = [...body].sort((a, b) => a.position - b.position).map((entry) => entry.id);

  const ctx = buildArchiveContext(result.session, result.membership);
  const reorderResult = await reorderContentSections(ctx.companyId, ctx.tenantId, itemId, orderedIds);

  if (!reorderResult.ok) {
    return NextResponse.json({ ok: false, reason: reorderResult.reason }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
