import { NextResponse } from "next/server";
import { archive } from "@/lib/docArchive/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { archiveErrorStatus, requireArchiveMembership } from "@/lib/docArchive/route";

// The tenant's whole tag vocabulary (0.2.0 delivery) — used client-side only
// for autocomplete suggestions when attaching a tag; requires no capability
// beyond a valid Archive context.
export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const ctx = buildArchiveContext(result.session, result.membership);
  const listResult = await archive.listTags(ctx);

  if (!listResult.ok) {
    return NextResponse.json(
      { ok: false, reason: listResult.error.category, message: listResult.error.message },
      { status: archiveErrorStatus(listResult.error.category) },
    );
  }

  return NextResponse.json({ ok: true, tags: listResult.value });
}
