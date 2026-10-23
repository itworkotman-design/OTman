import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

const membershipSummarySelect = Prisma.validator<Prisma.MembershipSelect>()({
  role: true,
  user: { select: { username: true, email: true } },
});

// Everything attached to an order. Attachment storage keys and the GSM raw
// webhook payloads stay out: the former are S3 object keys, the latter are
// large and duplicated by the task's own fields.
const mcpFullOrderInclude = Prisma.validator<Prisma.OrderInclude>()({
  createdByMembership: { select: membershipSummarySelect },
  lastEditedByMembership: { select: membershipSummarySelect },
  customerMembership: { select: membershipSummarySelect },
  events: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      actorName: true,
      actorEmail: true,
      actorSource: true,
      payload: true,
      createdAt: true,
    },
  },
  emailMessages: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      direction: true,
      status: true,
      source: true,
      subject: true,
      bodyText: true,
      fromEmail: true,
      fromName: true,
      toEmail: true,
      toName: true,
      createdAt: true,
      sentAt: true,
      receivedAt: true,
    },
  },
  notifications: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      payload: true,
      scheduledFor: true,
      createdAt: true,
      resolvedAt: true,
    },
  },
  items: { orderBy: [{ cardId: "asc" }, { createdAt: "asc" }] },
  orderAttachments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      category: true,
      source: true,
      createdAt: true,
    },
  },
  gsmTasks: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      gsmTaskId: true,
      category: true,
      reference: true,
      state: true,
      address: true,
      hasNotes: true,
      completedAt: true,
      lastWebhookAt: true,
      lastSyncedAt: true,
    },
  },
});

// Internal ids and bearer tokens: actionToken authorizes customer approve/pay
// links, emailThreadToken routes inbound email replies to the order.
const OMITTED_ORDER_FIELDS = [
  "id",
  "companyId",
  "actionToken",
  "emailThreadToken",
] as const;

type RouteContext = { params: Promise<{ orderNumber: string }> };

type MembershipSummary = {
  role: string;
  user: { username: string | null; email: string };
} | null;

function parseOrderNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const orderNumber = Number(value);
  return Number.isSafeInteger(orderNumber) && orderNumber > 0
    ? orderNumber
    : null;
}

function summarizeMembership(membership: MembershipSummary) {
  if (!membership) {
    return null;
  }

  return {
    username: membership.user.username,
    email: membership.user.email,
    role: membership.role,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  const { orderNumber: rawOrderNumber } = await context.params;
  const orderNumber = parseOrderNumber(rawOrderNumber);

  if (orderNumber === null) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_ORDER_NUMBER" },
      { status: 400 },
    );
  }

  try {
    const order = await prisma.order.findUnique({
      where: {
        companyId_displayId: {
          companyId: authentication.companyId,
          displayId: orderNumber,
        },
      },
      include: mcpFullOrderInclude,
    });

    if (!order) {
      return NextResponse.json(
        { ok: false, reason: "ORDER_NOT_FOUND" },
        { status: 404 },
      );
    }

    const {
      displayId,
      orderNumber: customerReference,
      status,
      createdByMembership,
      lastEditedByMembership,
      customerMembership,
      events,
      emailMessages,
      notifications,
      items,
      orderAttachments,
      gsmTasks,
      ...fields
    } = order;

    for (const key of OMITTED_ORDER_FIELDS) {
      delete (fields as Record<string, unknown>)[key];
    }

    return NextResponse.json({
      order: {
        orderNumber: displayId,
        customerReference,
        status: normalizeOrderStatus(status) || null,
        rawStatus: status,
        ...fields,
        createdBy: summarizeMembership(createdByMembership),
        lastEditedBy: summarizeMembership(lastEditedByMembership),
        customer: summarizeMembership(customerMembership),
        history: events,
        emailMessages,
        notifications,
        items,
        attachments: orderAttachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          category: attachment.category,
          source: attachment.source,
          createdAt: attachment.createdAt,
        })),
        gsmTasks: gsmTasks.map((task) => ({
          id: task.id,
          gsmTaskId: task.gsmTaskId,
          category: task.category,
          reference: task.reference,
          state: task.state,
          address: task.address,
          hasNotes: task.hasNotes,
          completedAt: task.completedAt,
          lastWebhookAt: task.lastWebhookAt,
          lastSyncedAt: task.lastSyncedAt,
        })),
      },
    });
  } catch (error) {
    console.error("MCP full order lookup failed", {
      orderNumber,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
