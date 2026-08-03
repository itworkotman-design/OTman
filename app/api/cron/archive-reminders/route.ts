import { NextResponse } from "next/server";
import { advanceDueArchiveReminders } from "@/lib/docArchive/reminderRecurrence";

// Same CRON_SECRET Bearer-auth pattern as the other cron routes
// (archive-retention, recurring-orders): meant to be called by an external
// scheduler, not a user session.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const summary = await advanceDueArchiveReminders();

  return NextResponse.json({ ok: true, ...summary });
}
