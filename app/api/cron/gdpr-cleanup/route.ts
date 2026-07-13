import { NextResponse } from "next/server";
import { parseGdprLimitParam, runGdprCleanup } from "@/lib/gdpr/runGdprCleanup";

// Optional ?limit=N caps how many orders this single run processes per
// sweep (oldest paidAt first) — lets a large backlog be worked through in
// controlled batches, e.g. from a scheduled higher-frequency small-batch
// cron, instead of one run trying to touch everything at once.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const limit = parseGdprLimitParam(new URL(req.url).searchParams);
  const summary = await runGdprCleanup({ limit });

  return NextResponse.json({ ok: true, ...summary });
}
