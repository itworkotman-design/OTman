import { NextResponse } from "next/server";
import { generateAndReconcileArchiveReminderOccurrences } from "@/lib/docArchive/reminderOccurrences";

// Same CRON_SECRET Bearer-auth pattern as the other cron routes
// (archive-retention, archive-reminders): the read API already triggers
// generation lazily on every dashboard load, so this exists purely so a
// scheduled run can do the work ahead of time instead of every page load
// paying the full scan cost.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  await generateAndReconcileArchiveReminderOccurrences();

  return NextResponse.json({ ok: true });
}
