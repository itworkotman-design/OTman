import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireDashboardSection } from "@/lib/users/requireDashboardSection";

// Every order currently on a GDPR hold, regardless of status. A hold placed
// while an order was Invoiced can outlive that status (e.g. once it's
// marked Paid) — the "Invoiced orders awaiting payment" warning only ever
// lists Invoiced orders, so a held order that has since moved on would
// otherwise have no page it's manageable from.
export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  const gate = await requireDashboardSection(session, "GDPR");
  if (!gate.ok) return gate.response;
  if (!session?.activeCompanyId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });

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
