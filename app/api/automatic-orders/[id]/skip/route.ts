import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canManageAutomaticOrders } from "@/lib/users/orderAccess";
import { parseIsoDate } from "@/lib/dates/isoDate";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  if (!membership || !canManageAutomaticOrders(membership.role)) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;

  const template = await prisma.recurringOrderTemplate.findFirst({
    where: { id, companyId: session.activeCompanyId },
    select: { id: true },
  });

  if (!template) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const occurrenceDate = typeof body?.occurrenceDate === "string" ? body.occurrenceDate : "";

  if (!parseIsoDate(occurrenceDate)) {
    return NextResponse.json({ ok: false, reason: "INVALID_OCCURRENCE_DATE" }, { status: 400 });
  }

  try {
    await prisma.recurringOrderOccurrence.create({
      data: { templateId: template.id, occurrenceDate, status: "SKIPPED" },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, reason: "ALREADY_HANDLED" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
