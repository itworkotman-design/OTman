import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

// Every order currently on a GDPR hold, regardless of status. A hold placed
// while an order was Invoiced can outlive that status (e.g. once it's
// marked Paid) — the "Invoiced orders awaiting payment" warning only ever
// lists Invoiced orders, so a held order that has since moved on would
// otherwise have no page it's manageable from.
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

  const orders = await prisma.order.findMany({
    where: {
      companyId: session.activeCompanyId,
      gdprHold: true,
    },
    select: {
      id: true,
      displayId: true,
      status: true,
      deliveryDate: true,
      gdprHoldReason: true,
      gdprHoldSetAt: true,
    },
    orderBy: { gdprHoldSetAt: "asc" },
  });

  return NextResponse.json({ ok: true, orders });
}
