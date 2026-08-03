import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";
import { generateDueOccurrences } from "@/lib/orders/recurringOrders/generateDueOccurrences";

export async function POST(req: Request) {
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
    select: { role: true, appAccess: { select: { module: true, enabled: true, level: true } } },
  });

  if (!membership || !getModuleAccess(membership, "SCHEDULER").enabled) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const summary = await generateDueOccurrences({ companyId: session.activeCompanyId });

  return NextResponse.json({ ok: true, ...summary });
}
