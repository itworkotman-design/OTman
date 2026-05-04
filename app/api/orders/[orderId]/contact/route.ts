import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canCreateOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

function formatPersonName(username: string | null, email: string) {
  return username?.trim() || email.trim();
}

function buildSubject(order: { displayId: number; orderNumber: string | null }) {
  return order.orderNumber?.trim() ? `Order ${order.displayId} | ${order.orderNumber.trim()}` : `Order ${order.displayId}`;
}

function appendThreadToken(message: string, token: string) {
  const trimmed = message.trim();

  if (trimmed.includes(`[OTMAN:${token}]`)) {
    return trimmed;
  }

  return `${trimmed}\n\n[OTMAN:${token}]`;
}

async function getMembership(session: { userId: string; activeCompanyId: string | null }) {
  if (!session.activeCompanyId) return null;

  return prisma.membership.findFirst({
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
      permissions: {
        select: {
          permission: true,
        },
      },
    },
  });
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const membership = await getMembership(session);

  if (!membership) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const permissions = membership.permissions.map((item): AppPermission => item.permission);
  const isAdminOrOwner = membership.role === "OWNER" || membership.role === "ADMIN";
  const isOrderCreator = canCreateOrders(membership.role, permissions);

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
      ...(isAdminOrOwner
        ? {}
        : isOrderCreator
          ? {
              OR: [{ customerMembershipId: membership.id }, { createdByMembershipId: membership.id }],
            }
          : {
              subcontractorMembershipId: membership.id,
            }),
    },
    select: {
      id: true,
      companyId: true,
      displayId: true,
      orderNumber: true,
      emailThreadToken: true,
      needsEmailAttention: true,
      unreadInboundEmailCount: true,
      lastInboundEmailAt: true,
      lastOutboundEmailAt: true,
      emailMessages: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          direction: true,
          status: true,
          subject: true,
          bodyText: true,
          bodyHtml: true,
          fromEmail: true,
          fromName: true,
          toEmail: true,
          toName: true,
          createdAt: true,
          sentAt: true,
          receivedAt: true,
          sentByMembership: {
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
      },
    },
  });

  if (!order) {
    return NextResponse.json({ ok: false, reason: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    conversation: {
      defaultRecipientEmail: "",
      defaultRecipientName: "",
      threadToken: order.emailThreadToken ?? "",
      needsEmailAttention: order.needsEmailAttention,
      unreadInboundEmailCount: order.unreadInboundEmailCount,
      lastInboundEmailAt: order.lastInboundEmailAt,
      lastOutboundEmailAt: order.lastOutboundEmailAt,
      messages: order.emailMessages.map((message) => ({
        id: message.id,
        direction: message.direction,
        status: message.status,
        subject: message.subject,
        bodyText: message.bodyText ?? "",
        bodyHtml: message.bodyHtml ?? "",
        fromEmail: message.fromEmail,
        fromName: message.fromName ?? "",
        toEmail: message.toEmail,
        toName: message.toName ?? "",
        createdAt: message.createdAt,
        sentAt: message.sentAt,
        receivedAt: message.receivedAt,
        sentByName: message.sentByMembership ? formatPersonName(message.sentByMembership.user.username, message.sentByMembership.user.email) : "",
        sentByEmail: message.sentByMembership?.user.email ?? "",
      })),
    },
  });
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const membership = await getMembership(session);

  if (!membership) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const permissions = membership.permissions.map((item): AppPermission => item.permission);
  const isAdminOrOwner = membership.role === "OWNER" || membership.role === "ADMIN";
  if (isAdminOrOwner) {
    return NextResponse.json({ ok: false, reason: "ADMINS_USE_EMAIL_ROUTE" }, { status: 403 });
  }
  const isOrderCreator = canCreateOrders(membership.role, permissions);

  const { orderId } = await params;
  const body = await req.json().catch(() => null);

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const subjectInput = typeof body?.subject === "string" ? body.subject.trim() : "";

  if (!message) {
    return NextResponse.json({ ok: false, reason: "MESSAGE_REQUIRED" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
      ...(isAdminOrOwner
        ? {}
        : isOrderCreator
          ? {
              OR: [{ customerMembershipId: membership.id }, { createdByMembershipId: membership.id }],
            }
          : {
              subcontractorMembershipId: membership.id,
            }),
    },
    select: {
      id: true,
      companyId: true,
      displayId: true,
      orderNumber: true,
      emailThreadToken: true,
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
      customerMembership: {
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
    return NextResponse.json({ ok: false, reason: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  const now = new Date();
  const threadToken = order.emailThreadToken ?? randomUUID().replace(/-/g, "");
  const subject = subjectInput || buildSubject(order);
  const bodyText = appendThreadToken(message, threadToken);

  const senderName = formatPersonName(membership.user.username, membership.user.email);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!order.emailThreadToken) {
      await tx.order.update({
        where: {
          id: order.id,
        },
        data: {
          emailThreadToken: threadToken,
        },
      });
    }

    await tx.orderEmailMessage.create({
      data: {
        orderId: order.id,
        companyId: order.companyId,
        direction: "INBOUND",
        status: "RECEIVED",
        sentByMembershipId: membership.id,
        subject,
        bodyText,
        bodyHtml: null,
        fromEmail: membership.user.email,
        fromName: senderName,
        toEmail: "admin",
        toName: "Admin",
        sentAt: null,
        receivedAt: now,
      },
    });

    await tx.order.update({
      where: {
        id: order.id,
      },
      data: {
        needsEmailAttention: true,
        unreadInboundEmailCount: {
          increment: 1,
        },
        lastInboundEmailAt: now,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
