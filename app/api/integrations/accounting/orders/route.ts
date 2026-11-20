import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authenticateAccountingRequest } from "@/lib/integrations/accounting/authenticateAccountingRequest";
import { accountingOrderSelect, toAccountingOrder } from "@/lib/integrations/accounting/accountingOrder";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;
/** A quarter at most per request; the accounting app asks one month at a time. */
const MAX_RANGE_DAYS = 92;
const DAY_MS = 24 * 60 * 60 * 1000;

function isDate(value: string | null): value is string {
  return !!value && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const badRequest = (reason: string) => NextResponse.json({ ok: false, reason }, { status: 400 });

/**
 * The orders delivered from `from` to `to` (inclusive, "YYYY-MM-DD"), oldest
 * first, `limit` at a time; pass `nextCursor` back as `cursor` for the next page.
 * Every status is returned with its normalized status, so the caller decides
 * which count.
 */
export async function GET(request: Request) {
  const authentication = authenticateAccountingRequest(request);

  if (!authentication.ok) {
    return NextResponse.json({ ok: false, reason: authentication.reason }, { status: authentication.status });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim() ?? null;
  const to = searchParams.get("to")?.trim() ?? null;
  const cursor = searchParams.get("cursor")?.trim() || null;
  const limitParam = searchParams.get("limit");
  const limit = limitParam === null ? DEFAULT_LIMIT : Number(limitParam);

  if (!isDate(from)) return badRequest("INVALID_FROM_DATE");
  if (!isDate(to)) return badRequest("INVALID_TO_DATE");
  if (from > to) return badRequest("INVALID_DATE_RANGE");
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS >= MAX_RANGE_DAYS) {
    return badRequest("DATE_RANGE_TOO_LONG");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return badRequest("INVALID_LIMIT");

  const companyId = authentication.companyId;

  try {
    const page = await prisma.order.findMany({
      where: { companyId, deliveryDate: { gte: from, lte: to } },
      select: accountingOrderSelect,
      orderBy: [{ deliveryDate: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const orders = page.slice(0, limit);

    const priceListIds = [...new Set(orders.flatMap((o) => (o.priceListId ? [o.priceListId] : [])))];
    const priceLists =
      priceListIds.length > 0
        ? await prisma.priceList.findMany({ where: { id: { in: priceListIds } }, select: { id: true, name: true } })
        : [];
    const context = { priceListNames: new Map(priceLists.map((p) => [p.id, p.name])) };

    return NextResponse.json({
      ok: true,
      orders: orders.map((order) => toAccountingOrder(order, context)),
      nextCursor: page.length > limit ? orders[orders.length - 1].id : null,
    });
  } catch (error) {
    console.error("Accounting orders lookup failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ ok: false, reason: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
