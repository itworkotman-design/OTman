import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export async function GET() {
  try {
    const { start, end } = getMonthRange();

    const [
      ordersThisMonth,
      completedOrders,
      activeOrders,
      pendingOrders,
      cancelledOrders,
      revenueOrders,
      allStatuses,
    ] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: { gte: start, lt: end },
        },
      }),

      prisma.order.count({
        where: {
          status: "completed",
        },
      }),

      prisma.order.count({
        where: {
          status: "active",
        },
      }),

      prisma.order.count({
        where: {
          status: "behandles",
        },
      }),

      prisma.order.count({
        where: {
          status: "cancelled",
        },
      }),

      prisma.order.findMany({
        where: {
          createdAt: { gte: start, lt: end },
        },
        select: {
          priceExVat: true,
        },
      }),

      prisma.order.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
      }),
    ]);

    const totalIncome = revenueOrders.reduce(
      (sum, order) => sum + Number(order.priceExVat ?? 0),
      0,
    );

    return NextResponse.json({
      ok: true,
      stats: {
        totalIncome,
        ordersThisMonth,
        completedOrders,
        activeOrders,
        pendingOrders,
        cancelledOrders,
      },
      statusBreakdown: allStatuses.map((item) => ({
        status: item.status ?? "unknown",
        count: item._count.status,
      })),
    });
  } catch (error) {
    console.error("Dashboard home error:", error);
    return NextResponse.json(
      { ok: false, reason: "Failed to load dashboard data" },
      { status: 500 },
    );
  }
}
