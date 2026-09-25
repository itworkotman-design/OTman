import { NextResponse } from "next/server";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export async function GET(request: Request) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  try {
    const { start, end } = getMonthRange();

    const [
      ordersThisMonth,
      completedOrders,
      activeOrders,
      pendingOrders,
      confirmedOrders,
      cancelledOrders,
      allStatuses,
    ] = await Promise.all([
      prisma.order.count({
        where: { companyId: authentication.companyId, createdAt: { gte: start, lt: end } },
      }),
      prisma.order.count({ where: { companyId: authentication.companyId, status: "completed" } }),
      prisma.order.count({ where: { companyId: authentication.companyId, status: "active" } }),
      prisma.order.count({ where: { companyId: authentication.companyId, status: "processing" } }),
      prisma.order.count({ where: { companyId: authentication.companyId, status: "confirmed" } }),
      prisma.order.count({ where: { companyId: authentication.companyId, status: "cancelled" } }),
      prisma.order.groupBy({
        where: { companyId: authentication.companyId },
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    return NextResponse.json({
      summary: {
        ordersThisMonth,
        completedOrders,
        activeOrders,
        pendingOrders,
        confirmedOrders,
        cancelledOrders,
        statusBreakdown: allStatuses.map((item) => ({
          status: item.status ?? "unknown",
          count: item._count.status,
        })),
      },
    });
  } catch (error) {
    console.error("MCP dashboard summary failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
