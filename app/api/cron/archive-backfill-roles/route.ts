import { NextResponse } from "next/server";
import { runArchiveRolesBackfill } from "@/lib/docArchive/runArchiveRolesBackfill";

// One-time (idempotent, safe to re-run) migration for the role-based Archive
// permission model — see lib/docArchive/runArchiveRolesBackfill.ts for the
// full explanation and why this is a route instead of a local script. Same
// CRON_SECRET Bearer-auth convention as the other cron routes
// (archive-backfill-display-codes, archive-retention, gdpr-cleanup,
// payment-timeout).
//
// Defaults to a DRY RUN — pass `?apply=1` (or JSON body `{"apply":true}`)
// to actually write changes. Review the dry-run response first; this
// touches production permission data.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const applyFromQuery = url.searchParams.get("apply") === "1";
  const body = await req.json().catch(() => null);
  const applyFromBody = body?.apply === true;
  const apply = applyFromQuery || applyFromBody;

  const summary = await runArchiveRolesBackfill(apply);

  return NextResponse.json({ ok: true, ...summary });
}
