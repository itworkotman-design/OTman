import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canCreateOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";

// Returns the distinct pricelists actually referenced by orders visible to
// the current user (not the pricelists they're currently assigned to) — used
// to decide whether the Orders table's "Pricelist" column/filter should show
// at all, and to populate the filter's options. Scoped by the same
// company/role rules as the main GET /api/orders handler, but deliberately
// without layering in the Status/Store/Partner/date filters that endpoint
// applies — this must reflect the user's full authorized visibility, not
// whatever they currently have selected in the filter bar.
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
      id: true,
      role: true,
      permissions: {
        select: {
          permission: true,
        },
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const permissions = membership.permissions.map(
    (p): AppPermission => p.permission,
  );

  const isAdminOrOwner =
    membership.role === "OWNER" || membership.role === "ADMIN";
  const isOrderCreator =
    !isAdminOrOwner && canCreateOrders(membership.role, permissions);

  const where: Prisma.OrderWhereInput = {
    companyId: session.activeCompanyId,
    priceListId: { not: null },
  };

  if (isOrderCreator) {
    where.OR = [
      { customerMembershipId: membership.id },
      { createdByMembershipId: membership.id },
    ];
  } else if (!isAdminOrOwner) {
    where.subcontractorMembershipId = membership.id;
  }

  const visibleOrders = await prisma.order.findMany({
    where,
    distinct: ["priceListId"],
    select: { priceListId: true },
  });

  const priceListIds = visibleOrders
    .map((order) => order.priceListId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const priceLists =
    priceListIds.length > 0
      ? await prisma.priceList.findMany({
          where: { id: { in: priceListIds } },
          select: { id: true, name: true },
        })
      : [];

  return NextResponse.json({
    ok: true,
    pricelists: priceLists
      .map((priceList) => ({ id: priceList.id, name: priceList.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}
