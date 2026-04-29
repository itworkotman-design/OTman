import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  hasFullAccess,
  isOrderCreatorAccess,
  isSubcontractorAccess,
} from "@/lib/users/access";
import type { AppPermission, Role } from "@/lib/users/types";

function getMembershipName(user: {
  email: string;
  username: string | null;
}) {
  return user.username?.trim() || user.email;
}

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
      status: "ACTIVE",
      user: {
        status: "ACTIVE",
      },
    },
    select: {
      id: true,
      role: true,
      legacyWordpressUserId: true,
      warehouseEmail: true,
      user: {
        select: {
          email: true,
          username: true,
          address: true,
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

      if (isSubcontractorAccess(permissions)) {
        return false;
      }

      if (hasFullAccess(membership.role as Role)) return true;
      if (isOrderCreatorAccess(permissions)) return true;
      return true;
    })
    .map((membership) => ({
      id: membership.id,
      name: getMembershipName(membership.user),
      email: membership.user.email,
      warehouseEmail: membership.warehouseEmail?.trim() || "",
      address: membership.user.address?.trim() || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    ok: true,
    orderCreators,
  });
}
