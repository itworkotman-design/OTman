import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDailyActivity(
  start: Date,
  end: Date,
  monthlyOrders: {
    createdAt: Date;
    priceExVat: number | null;
  }[],
) {
  const dailyMap = new Map<
    string,
    {
      date: string;
      orders: number;
      revenue: number;
    }
  >();

  for (
    const current = new Date(start);
    current < end;
    current.setDate(current.getDate() + 1)
  ) {
    const dateKey = formatDateKey(current);
    dailyMap.set(dateKey, {
      date: dateKey,
      orders: 0,
      revenue: 0,
    });
  }

  monthlyOrders.forEach((order) => {
    const dateKey = formatDateKey(order.createdAt);
    const current = dailyMap.get(dateKey);

    if (!current) {
      return;
    }

    current.orders += 1;
    current.revenue += Number(order.priceExVat ?? 0);
  });

  return Array.from(dailyMap.values());
}

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  try {
    const { start, end } = getMonthRange();
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.userId,
        companyId: session.activeCompanyId,
        status: "ACTIVE",
      },
      select: {
        role: true,
        company: {
          select: {
            orderEmailsEnabled: true,
          },
        },
      },
    });

    if (
      !membership ||
      (membership.role !== "OWNER" && membership.role !== "ADMIN")
    ) {
      return NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const [
      ordersThisMonth,
      completedOrders,
      activeOrders,
      pendingOrders,
      cancelledOrders,
      monthlyOrders,
      allStatuses,
      unreadInboundEmailAggregate,
    ] = await Promise.all([
      prisma.order.count({
        where: {
          companyId: session.activeCompanyId,
          createdAt: { gte: start, lt: end },
        },
      }),

      prisma.order.count({
        where: {
          companyId: session.activeCompanyId,
          status: "completed",
        },
      }),

      prisma.order.count({
        where: {
          companyId: session.activeCompanyId,
          status: "active",
        },
      }),

      prisma.order.count({
        where: {
          companyId: session.activeCompanyId,
          status: "processing",
        },
      }),

      prisma.order.count({
        where: {
          companyId: session.activeCompanyId,
          status: "cancelled",
        },
      }),

      prisma.order.findMany({
        where: {
          companyId: session.activeCompanyId,
          createdAt: { gte: start, lt: end },
        },
        select: {
          createdAt: true,
          priceExVat: true,
        },
      }),

      prisma.order.groupBy({
        where: {
          companyId: session.activeCompanyId,
        },
        by: ["status"],
        _count: {
          status: true,
        },
      }),

      prisma.order.aggregate({
        where: {
          companyId: session.activeCompanyId,
          unreadInboundEmailCount: {
            gt: 0,
          },
        },
        _sum: {
          unreadInboundEmailCount: true,
        },
      }),
    ]);

    const totalIncome = monthlyOrders.reduce(
      (sum, order) => sum + Number(order.priceExVat ?? 0),
      0,
    );
    const bookingEmailCount =
      unreadInboundEmailAggregate._sum.unreadInboundEmailCount ?? 0;
    const dailyActivity = buildDailyActivity(start, end, monthlyOrders);

    return NextResponse.json({
      ok: true,
      stats: {
        totalIncome,
        ordersThisMonth,
        completedOrders,
        activeOrders,
        pendingOrders,
        cancelledOrders,
        bookingEmailCount,
      },
      orderEmailsEnabled: membership.company?.orderEmailsEnabled !== false,
      statusBreakdown: allStatuses.map((item) => ({
        status: item.status ?? "unknown",
        count: item._count.status,
      })),
      dailyActivity,
    });
  } catch (error) {
    console.error("Dashboard home error:", error);
    return NextResponse.json(
      { ok: false, reason: "Failed to load dashboard data" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      role: true,
    },
  });

  if (
    !membership ||
    (membership.role !== "OWNER" && membership.role !== "ADMIN")
  ) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.orderEmailsEnabled !== "boolean") {
    return NextResponse.json(
      { ok: false, reason: "INVALID_ORDER_EMAILS_ENABLED" },
      { status: 400 },
    );
  }

  const company = await prisma.company.update({
    where: {
      id: session.activeCompanyId,
    },
    data: {
      orderEmailsEnabled: body.orderEmailsEnabled,
    },
    select: {
      orderEmailsEnabled: true,
    },
  });

  return NextResponse.json({
    ok: true,
    orderEmailsEnabled: company.orderEmailsEnabled,
  });
}
