import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

const INVOICED_WARNING_AFTER_MONTHS = 2;

function monthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

// Orders sitting in Invoiced/Fakturert too long never get anonymized
// automatically (only Paid starts that countdown), so they need a visible
// nudge on the dashboard home page instead — this is what backs that
// warning table.
export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const candidates = await prisma.order.findMany({
    where: {
      companyId: session.activeCompanyId,
      invoicedAt: { not: null, lte: monthsAgo(INVOICED_WARNING_AFTER_MONTHS) },
    },
    select: {
      id: true,
      displayId: true,
      deliveryDate: true,
      status: true,
      invoicedAt: true,
      gdprHold: true,
    },
    orderBy: { invoicedAt: "asc" },
  });

  const orders = candidates
    .filter((order) => normalizeOrderStatus(order.status) === "invoiced")
    .map((order) => ({
      id: order.id,
      displayId: order.displayId,
      deliveryDate: order.deliveryDate,
      status: order.status,
      invoicedAt: order.invoicedAt,
      gdprHold: order.gdprHold,
    }));

  return NextResponse.json({ ok: true, orders });
}
