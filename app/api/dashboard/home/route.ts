import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function buildMonthlyComparison(
  currentYear: number,
  lastYear: number,
  yearOrders: { createdAt: Date }[],
) {
  const monthly = MONTH_LABELS.map((monthLabel, index) => ({
    month: index + 1,
    monthLabel,
    currentYearOrders: 0,
    lastYearOrders: 0,
  }));

  yearOrders.forEach((order) => {
    const orderYear = order.createdAt.getFullYear();
    const orderMonth = order.createdAt.getMonth();
    const bucket = monthly[orderMonth];

    if (!bucket) {
      return;
    }

    if (orderYear === currentYear) {
      bucket.currentYearOrders += 1;
    } else if (orderYear === lastYear) {
      bucket.lastYearOrders += 1;
    }
  });

  return monthly;
}

function buildMonthlyRevenue(
  currentYear: number,
  lastYear: number,
  yearOrders: {
    createdAt: Date;
    priceExVat: number | null;
    priceSubcontractor: number | null;
  }[],
) {
  const monthly = MONTH_LABELS.map((monthLabel, index) => ({
    month: index + 1,
    monthLabel,
    subcontractor: 0,
    profit: 0,
    lastYearSubcontractor: 0,
    lastYearProfit: 0,
  }));

  yearOrders.forEach((order) => {
    const orderYear = order.createdAt.getFullYear();
    const bucket = monthly[order.createdAt.getMonth()];

    if (!bucket) {
      return;
    }

    const priceExVat = Number(order.priceExVat ?? 0);
    const subcontractor = Number(order.priceSubcontractor ?? 0);
    const profit = priceExVat - subcontractor;

    if (orderYear === currentYear) {
      bucket.subcontractor += subcontractor;
      bucket.profit += profit;
    } else if (orderYear === lastYear) {
      bucket.lastYearSubcontractor += subcontractor;
      bucket.lastYearProfit += profit;
    }
  });

  return monthly;
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
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const yearRangeStart = new Date(lastYear, 0, 1);
    const yearRangeEnd = new Date(currentYear + 1, 0, 1);
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
      confirmedOrders,
      cancelledOrders,
      monthlyOrders,
      yearOrders,
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
          status: "confirmed",
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
          priceSubcontractor: true,
        },
      }),

      prisma.order.findMany({
        where: {
          companyId: session.activeCompanyId,
          createdAt: { gte: yearRangeStart, lt: yearRangeEnd },
        },
        select: {
          createdAt: true,
          priceExVat: true,
          priceSubcontractor: true,
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
      (sum, order) =>
        sum + Number(order.priceExVat ?? 0) - Number(order.priceSubcontractor ?? 0),
      0,
    );
    const bookingEmailCount =
      unreadInboundEmailAggregate._sum.unreadInboundEmailCount ?? 0;
    const monthlyRevenue = buildMonthlyRevenue(currentYear, lastYear, yearOrders);
    const monthlyComparison = buildMonthlyComparison(
      currentYear,
      lastYear,
      yearOrders,
    );

    return NextResponse.json({
      ok: true,
      stats: {
        totalIncome,
        ordersThisMonth,
        completedOrders,
        activeOrders,
        pendingOrders,
        confirmedOrders,
        cancelledOrders,
        bookingEmailCount,
      },
      orderEmailsEnabled: membership.company?.orderEmailsEnabled !== false,
      statusBreakdown: allStatuses.map((item) => ({
        status: item.status ?? "unknown",
        count: item._count.status,
      })),
      monthlyRevenue,
      monthlyComparison,
      currentYear,
      lastYear,
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
