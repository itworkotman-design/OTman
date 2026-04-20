import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

type OrderNotificationRouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

async function getAdminMembership(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return {
      companyId: null,
      membership: null,
      response: NextResponse.json(
        { ok: false, reason: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  if (!session.activeCompanyId) {
    return {
      companyId: null,
      membership: null,
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
      membership: null,
      response: NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 },
      ),
    };
  }

  return {
    companyId: session.activeCompanyId,
    membership,
    response: null,
  };
}

export async function GET(req: Request, { params }: OrderNotificationRouteParams) {
  const auth = await getAdminMembership(req);

  if (auth.response) {
    return auth.response;
  }

  if (!auth.companyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: auth.companyId,
    },
    select: {
      id: true,
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const notifications = await prisma.orderNotification.findMany({
    where: {
      orderId,
      companyId: auth.companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      createdAt: true,
      resolvedAt: true,
      resolvedByMembership: {
        select: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    notifications: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      resolvedAt: notification.resolvedAt,
      resolvedBy:
        notification.resolvedByMembership?.user.username ||
        notification.resolvedByMembership?.user.email ||
        "",
    })),
  });
}
