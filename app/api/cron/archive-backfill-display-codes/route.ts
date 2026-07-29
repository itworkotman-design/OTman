import { NextResponse } from "next/server";
import { runArchiveDisplayCodeBackfill } from "@/lib/docArchive/runArchiveDisplayCodeBackfill";

// One-time (idempotent, safe to re-run) backfill for folder/item display
// codes — see lib/docArchive/runArchiveDisplayCodeBackfill.ts for why this
// is a route instead of a local script. Same CRON_SECRET Bearer-auth
// convention as the other cron routes (archive-retention, gdpr-cleanup,
// payment-timeout).
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const summary = await runArchiveDisplayCodeBackfill();

  return NextResponse.json({ ok: true, ...summary });
}
