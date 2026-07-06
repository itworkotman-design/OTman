import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canManageAutomaticOrders } from "@/lib/users/orderAccess";
import { getOsloDateKey } from "@/lib/dates/isoDate";
import { computeUpcomingOccurrenceDates } from "@/lib/orders/recurringOrders/occurrenceDates";
import { computeTemplateHealth } from "@/lib/orders/recurringOrders/templateHealth";
import { validateTemplateInput } from "@/lib/orders/recurringOrders/validateTemplateInput";
import { generateDueOccurrences } from "@/lib/orders/recurringOrders/generateDueOccurrences";

async function requireCompanyMembership(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return { error: NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 }) } as const;
  }

  if (!session.activeCompanyId) {
    return {
      error: NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 }),
    } as const;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      user: { select: { username: true, email: true } },
    },
  });

  if (!membership || !canManageAutomaticOrders(membership.role)) {
    return { error: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }) } as const;
  }

  return { session, membership } as const;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCompanyMembership(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const template = await prisma.recurringOrderTemplate.findFirst({
    where: { id, companyId: auth.session.activeCompanyId! },
    include: {
      occurrences: {
        orderBy: { occurrenceDate: "desc" },
        take: 50,
      },
    },
  });

  if (!template) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const today = getOsloDateKey();
  const [nextOccurrenceDate] = computeUpcomingOccurrenceDates(template, { from: today, count: 1 });
  const health = await computeTemplateHealth({
    companyId: template.companyId,
    recurrenceType: template.recurrenceType,
    recurrenceConfig: template.recurrenceConfig,
    orderDefaults: template.orderDefaults,
  });

  return NextResponse.json({
    ok: true,
    template: {
      id: template.id,
      name: template.name,
      isPaused: template.isPaused,
      recurrenceType: template.recurrenceType,
      recurrenceConfig: template.recurrenceConfig,
      leadTimeDays: template.leadTimeDays,
      startDate: template.startDate,
      endDate: template.endDate,
      orderDefaults: template.orderDefaults,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      nextOccurrenceDate: nextOccurrenceDate ?? null,
      health,
      occurrences: template.occurrences.map((occurrence) => ({
        id: occurrence.id,
        occurrenceDate: occurrence.occurrenceDate,
        status: occurrence.status,
        orderId: occurrence.orderId,
        failureReason: occurrence.failureReason,
        generatedAt: occurrence.generatedAt,
        updatedAt: occurrence.updatedAt,
      })),
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCompanyMembership(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const existing = await prisma.recurringOrderTemplate.findFirst({
    where: { id, companyId: auth.session.activeCompanyId! },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);

  // A pause/resume toggle is the only partial update the UI needs; anything
  // else (editing order defaults or the recurrence rule) resubmits the full
  // template shape and is validated in full. Edits here only ever affect
  // future, not-yet-generated occurrences — past Orders are fully
  // materialized rows and are never touched by a template edit.
  if (
    body &&
    typeof body === "object" &&
    "isPaused" in body &&
    Object.keys(body).length === 1 &&
    typeof (body as { isPaused: unknown }).isPaused === "boolean"
  ) {
    const isPaused = (body as { isPaused: boolean }).isPaused;
    const template = await prisma.recurringOrderTemplate.update({
      where: { id },
      data: { isPaused },
    });

    // Resuming a template that's already due today should catch up
    // immediately rather than waiting for the next cron tick.
    const generation = isPaused ? undefined : await generateDueOccurrences({ templateId: template.id });

    return NextResponse.json({ ok: true, templateId: template.id, generation });
  }

  const validated = validateTemplateInput(body, {
    membershipId: auth.membership.id,
    label: auth.membership.user.username || auth.membership.user.email,
  });

  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, reason: validated.error.reason, message: validated.error.message },
      { status: 400 },
    );
  }

  const template = await prisma.recurringOrderTemplate.update({
    where: { id },
    data: {
      name: validated.value.name,
      recurrenceType: validated.value.recurrenceType,
      recurrenceConfig: validated.value.recurrenceConfig as Prisma.InputJsonValue,
      leadTimeDays: validated.value.leadTimeDays,
      startDate: validated.value.startDate,
      endDate: validated.value.endDate,
      orderDefaults: validated.value.orderDefaults as Prisma.InputJsonValue,
    },
  });

  // The edit may have just made an occurrence due today (e.g. a newly added
  // custom date, or a shortened lead time) — generate immediately rather
  // than waiting for the next cron tick.
  const generation = await generateDueOccurrences({ templateId: template.id });

  return NextResponse.json({ ok: true, templateId: template.id, generation });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCompanyMembership(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const existing = await prisma.recurringOrderTemplate.findFirst({
    where: { id, companyId: auth.session.activeCompanyId! },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  // Cascades only to RecurringOrderOccurrence log rows. Order has no
  // cascading FK to the template, so previously generated Orders are never
  // deleted or orphaned.
  await prisma.recurringOrderTemplate.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
