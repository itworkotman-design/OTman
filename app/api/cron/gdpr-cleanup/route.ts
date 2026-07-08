import { NextResponse } from "next/server";
import { runGdprCleanup } from "@/lib/gdpr/runGdprCleanup";

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const summary = await runGdprCleanup();

  return NextResponse.json({ ok: true, ...summary });
}
