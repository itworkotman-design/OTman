import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type TimelineRow = {
  displayId: number;
  status: string | null;
  timeWindow: string | null;
  confirmedAt: Date | null;
};

type QueryClient = {
  $queryRaw?: <T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ) => Promise<T>;
};

function isMissingOrderEventTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
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
  const date = searchParams.get("date")?.trim();

  if (!date || !DATE_PATTERN.test(date)) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_DATE" },
      { status: 400 },
    );
  }

  const queryClient = prisma as unknown as QueryClient;

  if (!queryClient.$queryRaw) {
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  try {
    let rows: TimelineRow[];

    try {
      rows = await queryClient.$queryRaw<TimelineRow[]>(
        Prisma.sql`
          SELECT
            o."displayId",
            o."status",
            o."timeWindow",
            (
              SELECT oe."createdAt"
              FROM "OrderEvent" oe
              WHERE oe."orderId" = o."id"
                AND oe."type" = 'STATUS_CHANGED'
                AND oe."payload"->>'toStatus' = 'confirmed'
              ORDER BY oe."createdAt" ASC
              LIMIT 1
            ) AS "confirmedAt"
          FROM "Order" o
          WHERE o."companyId" = ${authentication.companyId}
            AND o."deliveryDate" = ${date}
          ORDER BY o."displayId" ASC
        `,
      );
    } catch (error) {
      if (!isMissingOrderEventTableError(error)) {
        throw error;
      }

      // OrderEvent history isn't available in every environment yet — fall
      // back to status/time-window only rather than failing the whole
      // request when confirmation timing simply isn't recorded.
      const orders = await prisma.order.findMany({
        where: { companyId: authentication.companyId, deliveryDate: date },
        select: { displayId: true, status: true, timeWindow: true },
        orderBy: { displayId: "asc" },
      });

      rows = orders.map((order) => ({ ...order, confirmedAt: null }));
    }

    return NextResponse.json({
      date,
      orders: rows.map((row) => ({
        orderNumber: row.displayId,
        status: normalizeOrderStatus(row.status),
        timeWindow: row.timeWindow,
        confirmedAt: row.confirmedAt,
      })),
    });
  } catch (error) {
    console.error("MCP order status timeline failed", {
      date,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
