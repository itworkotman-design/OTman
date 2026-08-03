import { NextResponse } from "next/server";
import type { RecurrenceType } from "@prisma/client";
import { buildArchiveContext } from "@/lib/docArchive/context";
import { requireArchiveMembership } from "@/lib/docArchive/route";
import { setFolderReminderSettings } from "@/lib/docArchive/reminderNotes";
import { isRecurrenceConfigValid } from "@/lib/orders/recurringOrders/occurrenceDates";

const RECURRENCE_TYPES: RecurrenceType[] = ["WEEKLY", "MONTHLY", "CUSTOM_DATES"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { folderId } = await params;
  const body = await req.json().catch(() => null);
  const description = body?.description;
  const recurrenceType = body?.recurrenceType;
  const recurrenceConfig = body?.recurrenceConfig;

  if (description !== null && typeof description !== "string") {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  if (recurrenceType !== null && !RECURRENCE_TYPES.includes(recurrenceType)) {
    return NextResponse.json({ ok: false, reason: "INVALID_INPUT" }, { status: 400 });
  }

  if (recurrenceType !== null && !isRecurrenceConfigValid(recurrenceType, recurrenceConfig)) {
    return NextResponse.json({ ok: false, reason: "INVALID_RECURRENCE_CONFIG" }, { status: 400 });
  }

  const ctx = buildArchiveContext(result.session, result.membership);
  const trimmedDescription = typeof description === "string" ? description.trim() : null;

  await setFolderReminderSettings(ctx.companyId, ctx.tenantId, folderId, {
    description: trimmedDescription || null,
    recurrenceType,
    recurrenceConfig: recurrenceType ? recurrenceConfig : null,
  });

  return NextResponse.json({
    ok: true,
    description: trimmedDescription || null,
    recurrenceType,
    recurrenceConfig: recurrenceType ? recurrenceConfig : null,
  });
}
