import { NextResponse } from "next/server";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim();

  if (!date || !DATE_PATTERN.test(date)) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_DATE" },
      { status: 400 },
    );
  }

  try {
    const grouped = await prisma.order.groupBy({
      by: ["status"],
      where: {
        companyId: authentication.companyId,
        deliveryDate: date,
      },
      _count: { status: true },
    });

    const statusBreakdown = grouped.map((row) => ({
      status: normalizeOrderStatus(row.status),
      count: row._count.status,
    }));

    const total = statusBreakdown.reduce((sum, row) => sum + row.count, 0);

    return NextResponse.json({
      summary: { date, total, statusBreakdown },
    });
  } catch (error) {
    console.error("MCP order status summary failed", {
      date,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
