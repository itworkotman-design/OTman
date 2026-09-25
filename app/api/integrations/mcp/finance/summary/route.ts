import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function roundNok(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getRevenue(pricingSnapshot: unknown): number {
  if (!pricingSnapshot || typeof pricingSnapshot !== "object") {
    return 0;
  }

  const customer = (pricingSnapshot as { customer?: { totalIncVat?: number } })
    .customer;
  return typeof customer?.totalIncVat === "number" ? customer.totalIncVat : 0;
}

export async function GET(request: Request) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("fromDate")?.trim();
  const toDate = searchParams.get("toDate")?.trim();
  const customer = searchParams.get("customer")?.trim();

  if (fromDate && !DATE_PATTERN.test(fromDate)) {
    return NextResponse.json({ ok: false, reason: "INVALID_FROM_DATE" }, { status: 400 });
  }

  if (toDate && !DATE_PATTERN.test(toDate)) {
    return NextResponse.json({ ok: false, reason: "INVALID_TO_DATE" }, { status: 400 });
  }

  const where: Prisma.OrderWhereInput = {
    companyId: authentication.companyId,
  };

  if (fromDate || toDate) {
    where.deliveryDate = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  if (customer) {
    where.customerLabel = { contains: customer, mode: "insensitive" };
  }

  try {
    // Financial totals must reflect every matching order, not a capped
    // sample, so this intentionally has no `take` limit unlike list_orders —
    // callers should narrow fromDate/toDate for a large company history.
    const orders = await prisma.order.findMany({
      where,
      select: { customerLabel: true, pricingSnapshot: true },
    });

    const byStore = new Map<string, { revenue: number; orderCount: number }>();
    let totalRevenue = 0;

    for (const order of orders) {
      const revenue = getRevenue(order.pricingSnapshot);
      const storeKey = order.customerLabel ?? "Unknown";

      totalRevenue += revenue;

      const entry = byStore.get(storeKey) ?? { revenue: 0, orderCount: 0 };
      entry.revenue += revenue;
      entry.orderCount += 1;
      byStore.set(storeKey, entry);
    }

    const storeBreakdown = Array.from(byStore.entries())
      .map(([store, entry]) => ({
        store,
        revenue: roundNok(entry.revenue),
        orderCount: entry.orderCount,
        averagePerOrder:
          entry.orderCount > 0 ? roundNok(entry.revenue / entry.orderCount) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      summary: {
        fromDate: fromDate ?? null,
        toDate: toDate ?? null,
        customer: customer ?? null,
        totalRevenue: roundNok(totalRevenue),
        orderCount: orders.length,
        averagePerOrder:
          orders.length > 0 ? roundNok(totalRevenue / orders.length) : 0,
        storeBreakdown,
      },
    });
  } catch (error) {
    console.error("MCP financial summary lookup failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
