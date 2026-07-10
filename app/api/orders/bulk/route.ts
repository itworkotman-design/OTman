import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { optionalString } from "@/lib/orders/normalizeOrderInput";
import {
  buildOrderEventSnapshot,
  createManyOrderStatusChangedEvents,
  createOrderUpdatedEvent,
  diffOrderEventSnapshots,
} from "@/lib/orders/orderEvents";
import { resolveAllOrderNotifications } from "@/lib/orders/orderNotifications";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

function shouldClearCancelledDiscount(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
) {
  return (
    normalizeOrderStatus(previousStatus) === "cancelled" &&
    normalizeOrderStatus(nextStatus) !== "cancelled"
  );
}

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
      id: true,
      role: true,
      user: {
        select: {
          username: true,
          email: true,
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

  const ordersBeforeUpdate = await prisma.order.findMany({
    where: {
      id: {
        in: orderIds,
      },
      companyId: session.activeCompanyId,
    },
    select: {
      id: true,
      companyId: true,
      displayId: true,
      status: true,
      statusNotes: true,
      customerLabel: true,
      customerName: true,
      deliveryDate: true,
      timeWindow: true,
      pickupAddress: true,
      extraPickupAddress: true,
      deliveryAddress: true,
      returnAddress: true,
      drivingDistance: true,
      phone: true,
      phoneTwo: true,
      email: true,
      customerComments: true,
      description: true,
      orderNumber: true,
      productsSummary: true,
      deliveryTypeSummary: true,
      servicesSummary: true,
      cashierName: true,
      cashierPhone: true,
      subcontractor: true,
      driver: true,
      secondDriver: true,
      driverInfo: true,
      licensePlate: true,
      deviation: true,
      feeExtraWork: true,
      extraWorkMinutes: true,
      feeAddToOrder: true,
      dontSendEmail: true,
      priceExVat: true,
      priceSubcontractor: true,
      rabatt: true,
      leggTil: true,
      subcontractorMinus: true,
      subcontractorPlus: true,
      gsmLastTaskState: true,
      paidAt: true,
      invoicedAt: true,
      gdprHold: true,
    },
  });

  const normalizedStatus = status ? normalizeOrderStatus(status) : null;

  // Orders on GDPR hold must never be bulk-flipped to Betalt, even when
  // selected — the hold is what pauses the auto-anonymization countdown, so
  // silently starting it here would defeat the point of placing a hold.
  const heldOrderIds =
    normalizedStatus === "paid"
      ? ordersBeforeUpdate.filter((order) => order.gdprHold).map((order) => order.id)
      : [];
  const heldOrderIdSet = new Set(heldOrderIds);
  const effectiveOrderIds = orderIds.filter((id: string) => !heldOrderIdSet.has(id));
  const effectiveOrdersBeforeUpdate = ordersBeforeUpdate.filter(
    (order) => !heldOrderIdSet.has(order.id),
  );

  const result = await prisma.order.updateMany({
    where: {
      id: {
        in: effectiveOrderIds,
      },
      companyId: session.activeCompanyId,
    },
    data: {
      ...data,
      lastEditedByMembershipId: membership.id,
    },
  });

  // updateMany applies one literal `data` value to every matched row, so a
  // conditional "only stamp if not already set" (the same set-once rule used
  // for completedAt on the single-order route) needs its own pass — same
  // approach the cancelled-discount handling below already uses for
  // per-row-conditional updates.
  const needsPaidAtStamp =
    normalizedStatus === "paid"
      ? effectiveOrdersBeforeUpdate.filter((order) => !order.paidAt).map((order) => order.id)
      : [];
  const needsInvoicedAtStamp =
    normalizedStatus === "invoiced"
      ? effectiveOrdersBeforeUpdate.filter((order) => !order.invoicedAt).map((order) => order.id)
      : [];

  if (needsPaidAtStamp.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: needsPaidAtStamp }, companyId: session.activeCompanyId },
      data: { paidAt: new Date() },
    });
  }

  if (needsInvoicedAtStamp.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: needsInvoicedAtStamp }, companyId: session.activeCompanyId },
      data: { invoicedAt: new Date() },
    });
  }

  const cancelledOrdersLeavingCancelled = status
    ? effectiveOrdersBeforeUpdate
        .filter((order) => shouldClearCancelledDiscount(order.status, status))
        .map((order) => order.id)
    : [];
  const cancelledOrdersLeavingCancelledSet = new Set(
    cancelledOrdersLeavingCancelled,
  );

  const newlyCancelledOrders =
    status && normalizeOrderStatus(status) === "cancelled"
      ? effectiveOrdersBeforeUpdate.filter(
          (order) =>
            normalizeOrderStatus(order.status) !== "cancelled" &&
            !cancelledOrdersLeavingCancelledSet.has(order.id),
        )
      : [];

  const newlyCancelledMap = new Map(
    newlyCancelledOrders.map((order) => [
      order.id,
      {
        rabatt: String(Math.round(Number(order.priceExVat ?? 0))),
        subcontractorMinus: String(
          Math.round(Number(order.priceSubcontractor ?? 0)),
        ),
      },
    ]),
  );

  if (cancelledOrdersLeavingCancelled.length > 0) {
    await prisma.order.updateMany({
      where: {
        id: {
          in: cancelledOrdersLeavingCancelled,
        },
        companyId: session.activeCompanyId,
      },
      data: {
        rabatt: null,
        subcontractorMinus: null,
        pricingSnapshot: Prisma.DbNull,
      },
    });
  }

  if (newlyCancelledOrders.length > 0) {
    await Promise.all(
      newlyCancelledOrders.map((order) => {
        const values = newlyCancelledMap.get(order.id)!;
        return prisma.order.update({
          where: { id: order.id },
          data: {
            rabatt: values.rabatt,
            subcontractorMinus: values.subcontractorMinus,
            pricingSnapshot: Prisma.DbNull,
          },
        });
      }),
    );
  }

  const actor = {
    membershipId: membership.id,
    name: membership.user.username ?? null,
    email: membership.user.email,
    source: "USER",
  } as const;

  const statusOnlyEvents: Array<{
    orderId: string;
    companyId: string;
    actor: typeof actor;
    fromStatus: string | null | undefined;
    toStatus: string | null | undefined;
    note?: string | null;
  }> = [];

  for (const order of effectiveOrdersBeforeUpdate) {
    const previousSnapshot = buildOrderEventSnapshot(order);
    const isLeavingCancelled = cancelledOrdersLeavingCancelledSet.has(order.id);
    const newlyCancelledValues = newlyCancelledMap.get(order.id);
    const nextSnapshot = buildOrderEventSnapshot({
      ...order,
      status: status ?? order.status,
      rabatt: isLeavingCancelled
        ? null
        : (newlyCancelledValues?.rabatt ?? order.rabatt),
      subcontractorMinus: isLeavingCancelled
        ? null
        : (newlyCancelledValues?.subcontractorMinus ?? order.subcontractorMinus),
      subcontractor: subcontractorName ?? order.subcontractor,
      customerName: customerName ?? order.customerName,
    });

    const changes = diffOrderEventSnapshots(previousSnapshot, nextSnapshot);

    const statusChanging = changes.some((c) => c.field === "status");
    if (statusChanging) {
      await resolveAllOrderNotifications(prisma, {
        orderId: order.id,
        companyId: order.companyId,
        resolvedByMembershipId: membership.id,
      });
    }

    if (changes.length === 1 && changes[0]?.field === "status") {
      statusOnlyEvents.push({
        orderId: order.id,
        companyId: order.companyId,
        actor,
        fromStatus: previousSnapshot.status,
        toStatus: nextSnapshot.status,
        note: nextSnapshot.statusNotes,
      });
      continue;
    }

    await createOrderUpdatedEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor,
      changes,
    });
  }

  await createManyOrderStatusChangedEvents(prisma, statusOnlyEvents);

  return NextResponse.json({
    ok: true,
    updatedCount: result.count,
    skippedHeldCount: heldOrderIds.length,
  });
}
