import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getDriverFilterOptions } from "@/lib/orders/driverNormalization";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      role: true,
    },
  });

  if (
    !membership ||
    (membership.role !== "OWNER" && membership.role !== "ADMIN")
  ) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  // Same scope as the admin order list: every order in the active company.
  const orders = await prisma.order.findMany({
    where: {
      companyId: session.activeCompanyId,
      driver: { not: null },
    },
    select: { driver: true },
    distinct: ["driver"],
  });

  return NextResponse.json({
    ok: true,
    drivers: getDriverFilterOptions(orders.map((order) => order.driver)),
  });
}
