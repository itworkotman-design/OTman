import { NextResponse } from "next/server";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { resolveArchiveReminderOccurrence } from "@/lib/docArchive/reminderOccurrences";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ occurrenceId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { occurrenceId } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action !== "accept" && action !== "snooze") {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  const updateResult = await resolveArchiveReminderOccurrence(result.membership.companyId, occurrenceId, action);

  if (!updateResult.ok) {
    return NextResponse.json({ ok: false, reason: updateResult.reason }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
