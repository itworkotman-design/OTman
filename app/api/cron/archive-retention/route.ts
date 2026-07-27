import { NextResponse } from "next/server";
import { parseArchiveRetentionLimitParam, runArchiveRetentionSweep } from "@/lib/docArchive/runArchiveRetentionSweep";

// Optional ?limit=N caps how many purge candidates each company's sweep
// processes per call, same convention as the gdpr-cleanup/payment-timeout
// cron routes.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const purgeLimit = parseArchiveRetentionLimitParam(new URL(req.url).searchParams);
  const summary = await runArchiveRetentionSweep({ purgeLimit });

  return NextResponse.json({ ok: true, ...summary });
}
