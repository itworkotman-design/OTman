import { NextResponse } from "next/server";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { advanceDueArchiveReminders } from "@/lib/docArchive/reminderRecurrence";

// Session-authenticated mirror of the cron route, scoped to the caller's own
// company — same relationship as /api/automatic-orders/generate-now to
// /api/cron/recurring-orders (one shared generation function, a session-auth
// entry point for on-demand admin use plus a secret-auth entry point for the
// scheduled run).
export async function POST(req: Request) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const summary = await advanceDueArchiveReminders({ companyId: result.membership.companyId });

  return NextResponse.json({ ok: true, ...summary });
}
