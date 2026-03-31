import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { optionalString } from "@/lib/orders/normalizeOrderInput";

export async function PATCH(req: Request) {
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

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const isAdminOrOwner =
    membership.role === "OWNER" || membership.role === "ADMIN";

  if (!isAdminOrOwner) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);

  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter(
        (value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const status = optionalString(body?.status);
  const subcontractorId = optionalString(body?.subcontractorId);
  const customerMembershipId = optionalString(body?.customerMembershipId);

  if (orderIds.length === 0) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_ORDER_IDS" },
      { status: 400 },
    );
  }

  if (!status && !subcontractorId && !customerMembershipId) {
    return NextResponse.json(
      { ok: false, reason: "NO_UPDATES_PROVIDED" },
      { status: 400 },
    );
  }

  let subcontractorName: string | null = null;

  if (subcontractorId) {
    const subcontractorMembership = await prisma.membership.findFirst({
      where: {
        id: subcontractorId,
        companyId: session.activeCompanyId,
        status: "ACTIVE",
      },
      select: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!subcontractorMembership) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_SUBCONTRACTOR" },
        { status: 400 },
      );
    }

    subcontractorName =
      subcontractorMembership.user.username?.trim() ||
      subcontractorMembership.user.email;
  }

  let customerName: string | null = null;

  if (customerMembershipId) {
    const customerMembership = await prisma.membership.findFirst({
      where: {
        id: customerMembershipId,
        companyId: session.activeCompanyId,
        status: "ACTIVE",
      },
      select: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!customerMembership) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_CUSTOMER" },
        { status: 400 },
      );
    }

    customerName =
      customerMembership.user.username?.trim() || customerMembership.user.email;
  }

  const data: {
    status?: string;
    subcontractorMembershipId?: string;
    subcontractor?: string;
    customerMembershipId?: string;
    customerName?: string;
  } = {};

  if (status) {
    data.status = status;
  }

  if (subcontractorId) {
    data.subcontractorMembershipId = subcontractorId;
    data.subcontractor = subcontractorName ?? "";
  }
  
  if (customerMembershipId) {
    data.customerMembershipId = customerMembershipId;
    data.customerName = customerName ?? "";
  }

  const result = await prisma.order.updateMany({
    where: {
      id: {
        in: orderIds,
      },
      companyId: session.activeCompanyId,
    },
    data,
  });

  return NextResponse.json({
    ok: true,
    updatedCount: result.count,
  });
}
