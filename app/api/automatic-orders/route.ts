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

export async function GET(req: Request) {
  const auth = await requireCompanyMembership(req);
  if ("error" in auth) return auth.error;

  const templates = await prisma.recurringOrderTemplate.findMany({
    where: { companyId: auth.session.activeCompanyId! },
    orderBy: { createdAt: "desc" },
    include: {
      occurrences: {
        orderBy: { occurrenceDate: "desc" },
        take: 5,
      },
    },
  });

  const today = getOsloDateKey();

  const result = await Promise.all(
    templates.map(async (template) => {
      const [nextOccurrenceDate] = computeUpcomingOccurrenceDates(template, {
        from: today,
        count: 1,
      });

      const health = await computeTemplateHealth({
        companyId: template.companyId,
        recurrenceType: template.recurrenceType,
        recurrenceConfig: template.recurrenceConfig,
        orderDefaults: template.orderDefaults,
      });

      return {
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
        recentOccurrences: template.occurrences.map((occurrence) => ({
          id: occurrence.id,
          occurrenceDate: occurrence.occurrenceDate,
          status: occurrence.status,
          orderId: occurrence.orderId,
          failureReason: occurrence.failureReason,
          generatedAt: occurrence.generatedAt,
          updatedAt: occurrence.updatedAt,
        })),
      };
    }),
  );

  return NextResponse.json({ ok: true, templates: result });
}

export async function POST(req: Request) {
  const auth = await requireCompanyMembership(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
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

  const template = await prisma.recurringOrderTemplate.create({
    data: {
      companyId: auth.session.activeCompanyId!,
      createdByMembershipId: auth.membership.id,
      name: validated.value.name,
      recurrenceType: validated.value.recurrenceType,
      recurrenceConfig: validated.value.recurrenceConfig as Prisma.InputJsonValue,
      leadTimeDays: validated.value.leadTimeDays,
      startDate: validated.value.startDate,
      endDate: validated.value.endDate,
      orderDefaults: validated.value.orderDefaults as Prisma.InputJsonValue,
    },
  });

  // If the new template is already due today (e.g. its lead time window or
  // an explicit custom date includes today), generate it immediately rather
  // than waiting for the next cron tick or a manual "Generate now" click.
  const generation = await generateDueOccurrences({ templateId: template.id });

  return NextResponse.json({ ok: true, templateId: template.id, generation });
}
