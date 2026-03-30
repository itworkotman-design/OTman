import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isOrderCreatorPermissions } from "@/lib/users/userAccess";
import type { AppPermission } from "@/lib/users/types";

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

  const memberships = await prisma.membership.findMany({
    where: {
      companyId: session.activeCompanyId,
      role: "USER",
      status: "ACTIVE",
      user: {
        status: "ACTIVE",
      },
    },
    select: {
      id: true,
      user: {
        select: {
          email: true,
          username: true,
        },
      },
      permissions: {
        select: {
          permission: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const orderCreators = memberships
    .filter((membership) => {
      const permissions = membership.permissions.map(
        (p) => p.permission,
      ) as AppPermission[];

      return isOrderCreatorPermissions(permissions);
    })
    .map((membership) => ({
      id: membership.id,
      name: membership.user.username?.trim() || membership.user.email,
      email: membership.user.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    ok: true,
    orderCreators,
  });
}
