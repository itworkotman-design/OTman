import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

const RETENTION_DAYS = 30;

function getRetentionCutoffDate() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  return cutoff;
}

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
    select: {
      role: true,
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const eligibleOrders = await prisma.order.findMany({
    where: {
      companyId: session.activeCompanyId,
      status: { in: ["completed", "invoiced", "paid", "failed", "cancelled"] },
      gdprAnonymized: false,
    },
    select: {
      id: true,
      status: true,
      completedAt: true,
      deliveryDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const cutoff = getRetentionCutoffDate();

  const orderIdsToAnonymize = eligibleOrders
    .filter((order) => {
      const delivery = order.deliveryDate ? new Date(order.deliveryDate) : null;
      const completed = order.completedAt ?? null;
      const updated = order.updatedAt ?? null;
      const created = order.createdAt ?? null;

      let basisDate: Date | null = null;

      const status = order.status ?? "";

      if (["failed", "cancelled"].includes(status)) {
        basisDate = updated ?? created;
      } else {
        if (delivery && completed) {
          basisDate = delivery < completed ? delivery : completed;
        } else {
          basisDate = delivery ?? completed;
        }
      }

      return basisDate && !Number.isNaN(basisDate.getTime()) && basisDate <= cutoff;
    })
    .map((order) => order.id);

 const result = await prisma.order.updateMany({
   where: {
     id: { in: orderIdsToAnonymize },
     companyId: session.activeCompanyId,
   },
   data: {
     customerName: null,
     phone: null,
     phoneTwo: null,
     email: null,
     deliveryAddress: null,
     customerComments: null,
     gdprAnonymized: true,
     gdprDeletedAt: new Date(),
   },
 });

  return NextResponse.json({
    ok: true,
    anonymizedCount: result.count,
    retentionDays: RETENTION_DAYS,
  });
}
