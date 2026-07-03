import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import {
  deleteCustomOrderNotification,
  resolveOrderNotification,
  updateCustomOrderNotification,
} from "@/lib/orders/orderNotifications";
import { parseCustomNotificationInput } from "@/lib/orders/customNotificationSchedule";

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

export async function PUT(
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

  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    message?: unknown;
    date?: unknown;
    hour?: unknown;
  } | null;

  const parsed = parseCustomNotificationInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, reason: parsed.reason }, { status: 400 });
  }

  const updated = await prisma.$transaction((tx) =>
    updateCustomOrderNotification(tx, {
      notificationId,
      orderId,
      companyId: auth.companyId as string,
      title: parsed.title,
      message: parsed.message,
      scheduledFor: parsed.scheduledFor,
    }),
  );

  if (!updated) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  const deleted = await prisma.$transaction((tx) =>
    deleteCustomOrderNotification(tx, {
      notificationId,
      orderId,
      companyId: auth.companyId as string,
    }),
  );

  if (!deleted) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
