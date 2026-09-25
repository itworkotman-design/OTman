import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RESULTS = 200;

// Statuses are stored inconsistently (Norwegian/English, mixed case) — this
// mirrors normalizeOrderStatus's own synonym table so a caller filtering by
// the normalized value ("confirmed") matches every raw spelling that
// normalizes to it, not just a literal string match against the column.
const STATUS_RAW_VARIANTS: Record<string, string[]> = {
  processing: ["processing", "behandles", "behandling"],
  approved: ["approved", "godkjent"],
  rejected: ["rejected", "avvist"],
  confirmed: ["confirmed", "bekreftet"],
  active: ["active", "aktiv"],
  cancelled: ["cancelled", "canceled", "kanselert", "avbrutt"],
  failed: ["failed", "fail", "feilet"],
  completed: ["completed", "ferdig"],
  invoiced: ["invoiced", "fakturet", "fakturert"],
  paid: ["paid", "betalt"],
};

type PricingSnapshot = {
  customer?: {
    discount?: number;
    extra?: number;
    vat?: number;
    totalIncVat?: number;
  };
  subcontractor?: {
    total?: number;
  };
  lines?: Array<{
    itemType?: string;
    optionLabel?: string;
    productName?: string;
    deliveryType?: string;
    quantity?: number;
    customerLineTotal?: number | null;
    subcontractorLineTotal?: number | null;
  }>;
};

function getPricingSnapshot(value: unknown): PricingSnapshot {
  return value && typeof value === "object" ? (value as PricingSnapshot) : {};
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
  const status = searchParams.get("status")?.trim();
  const driver = searchParams.get("driver")?.trim();

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

  if (driver) {
    where.driver = { contains: driver, mode: "insensitive" };
  }

  if (status) {
    const variants = STATUS_RAW_VARIANTS[status.toLowerCase()] ?? [status];
    where.OR = variants.map((variant) => ({
      status: { equals: variant, mode: "insensitive" as const },
    }));
  }

  try {
    const orders = await prisma.order.findMany({
      where,
      select: {
        displayId: true,
        orderNumber: true,
        customerName: true,
        customerLabel: true,
        deliveryDate: true,
        servicesSummary: true,
        status: true,
        driver: true,
        pricingSnapshot: true,
      },
      orderBy: { deliveryDate: "desc" },
      take: MAX_RESULTS,
    });

    return NextResponse.json({
      orders: orders.map((order) => {
        const snapshot = getPricingSnapshot(order.pricingSnapshot);

        return {
          orderNumber: order.displayId,
          externalReference: order.orderNumber,
          customer: order.customerName,
          store: order.customerLabel,
          deliveryDate: order.deliveryDate,
          services: order.servicesSummary,
          status: normalizeOrderStatus(order.status),
          driver: order.driver,
          discount: snapshot.customer?.discount ?? null,
          extra: snapshot.customer?.extra ?? null,
          vat: snapshot.customer?.vat ?? null,
          totalPrice: snapshot.customer?.totalIncVat ?? null,
          directCost: snapshot.subcontractor?.total ?? null,
          lines: (snapshot.lines ?? []).map((line) => ({
            itemType: line.itemType ?? null,
            label: line.optionLabel || line.productName || null,
            deliveryType: line.deliveryType ?? null,
            quantity: line.quantity ?? null,
            customerLineTotal: line.customerLineTotal ?? null,
            subcontractorLineTotal: line.subcontractorLineTotal ?? null,
          })),
        };
      }),
      truncated: orders.length === MAX_RESULTS,
    });
  } catch (error) {
    console.error("MCP order list lookup failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
