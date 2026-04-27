import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { buildOrderEventSnapshot } from "@/lib/orders/orderEvents";

type OrderEventRecord = {
  id: string;
  type: "CREATED" | "UPDATED" | "STATUS_CHANGED";
  actorName: string | null;
  actorEmail: string | null;
  actorSource: string | null;
  createdAt: Date;
  payload: unknown;
};

type OrderEventQueryClient = {
  $queryRaw?: <T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<T>;
};

function parsePayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    kind?: unknown;
    snapshot?: unknown;
    changes?: unknown;
    productChanges?: unknown;
    fromStatus?: unknown;
    toStatus?: unknown;
    note?: unknown;
  };

  if (candidate.kind === "created" && candidate.snapshot) {
    return {
      kind: "created" as const,
      snapshot: candidate.snapshot,
    };
  }

  if (candidate.kind === "updated" && Array.isArray(candidate.changes)) {
    return {
      kind: "updated" as const,
      changes: candidate.changes,
      productChanges: Array.isArray(candidate.productChanges)
        ? candidate.productChanges
        : [],
    };
  }

  if (
    candidate.kind === "status_changed" &&
    typeof candidate.fromStatus === "string" &&
    typeof candidate.toStatus === "string"
  ) {
    return {
      kind: "status_changed" as const,
      fromStatus: candidate.fromStatus,
      toStatus: candidate.toStatus,
      note: typeof candidate.note === "string" ? candidate.note : null,
    };
  }

  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
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

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
    },
    select: {
      id: true,
      companyId: true,
      createdAt: true,
      displayId: true,
      orderNumber: true,
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
      createdByMembership: {
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

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const orderEventDelegate = (
    prisma as unknown as {
      orderEvent?: {
        findMany: (args: {
          where: {
            orderId: string;
            companyId: string;
          };
          orderBy: {
            createdAt: "desc";
          };
        }) => Promise<OrderEventRecord[]>;
      };
    }
  ).orderEvent;
  const queryClient = prisma as unknown as OrderEventQueryClient;

  let events: OrderEventRecord[] = [];

  if (orderEventDelegate) {
    try {
      events = await orderEventDelegate.findMany({
        where: {
          orderId,
          companyId: session.activeCompanyId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2021"
        )
      ) {
        throw error;
      }
    }
  } else if (queryClient.$queryRaw) {
    events = await queryClient.$queryRaw<OrderEventRecord[]>(
      Prisma.sql`
        SELECT
          "id",
          "type",
          "actorName",
          "actorEmail",
          "actorSource",
          "createdAt",
          "payload"
        FROM "OrderEvent"
        WHERE "orderId" = ${orderId}
          AND "companyId" = ${session.activeCompanyId}
        ORDER BY "createdAt" DESC
      `,
    );
  }

  const hasCreatedEvent = events.some((event) => event.type === "CREATED");

  const history = events
    .map((event) => {
      const payload = parsePayload(event.payload);

      if (!payload) {
        return null;
      }

      return {
        id: event.id,
        type: event.type,
        actorName: event.actorName ?? "",
        actorEmail: event.actorEmail ?? "",
        actorSource: event.actorSource ?? "",
        createdAt: event.createdAt,
        payload,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (!hasCreatedEvent) {
    history.push({
      id: `synthetic-created-${order.id}`,
      type: "CREATED",
      actorName: order.createdByMembership.user.username ?? "",
      actorEmail: order.createdByMembership.user.email ?? "",
      actorSource: "SYNTHETIC",
      createdAt: order.createdAt,
      payload: {
        kind: "created" as const,
        snapshot: buildOrderEventSnapshot(order),
      },
    });

    history.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  return NextResponse.json({
    ok: true,
    history,
  });
}
