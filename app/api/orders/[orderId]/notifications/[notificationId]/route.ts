import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { resolveOrderNotification } from "@/lib/orders/orderNotifications";

type OrderNotificationItemRouteParams = {
  params: Promise<{
    orderId: string;
    notificationId: string;
  }>;
};

async function getAdminMembership(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return {
      companyId: null,
      membershipId: null,
      response: NextResponse.json(
        { ok: false, reason: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  if (!session.activeCompanyId) {
    return {
      companyId: null,
      membershipId: null,
      response: NextResponse.json(
        { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
        { status: 409 },
      ),
    };
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
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return {
      companyId: null,
      membershipId: null,
      response: NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 },
      ),
    };
  }

  return {
    companyId: session.activeCompanyId,
    membershipId: membership.id,
    response: null,
  };
}

export async function PATCH(
  req: Request,
  { params }: OrderNotificationItemRouteParams,
) {
  const auth = await getAdminMembership(req);

  if (auth.response) {
    return auth.response;
  }

  if (!auth.companyId || !auth.membershipId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const { orderId, notificationId } = await params;

  const resolved = await prisma.$transaction((tx) =>
    resolveOrderNotification(tx, {
      notificationId,
      orderId,
      companyId: auth.companyId,
      resolvedByMembershipId: auth.membershipId,
    }),
  );

  if (!resolved) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
