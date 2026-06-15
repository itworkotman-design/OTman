// path: app/api/integrations/gsm/webhook/route.ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchGsmTask } from "@/lib/integrations/gsm/fetchTask";
import { syncPodPdfWithRetry } from "@/lib/integrations/gsm/downloadPodPdf";
import {
  buildOrderEventSnapshot,
  createOrderActionEvent,
  createOrderStatusChangedEvent,
  createOrderUpdatedEvent,
  diffOrderEventSnapshots,
} from "@/lib/orders/orderEvents";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

function normalizeGsmState(state?: string | null) {
  const value = state?.trim().toLowerCase() ?? "";
  return value || null;
}

type GsmTaskRecord = Record<string, unknown>;

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getEventAction(body: Record<string, unknown>): string | null {
  return getTrimmedString(body.event) ?? getTrimmedString(body.action);
}

function getFirstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    const trimmed = getTrimmedString(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

function shouldClearCancelledDiscount(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
) {
  return (
    normalizeOrderStatus(previousStatus) === "cancelled" &&
    normalizeOrderStatus(nextStatus) !== "cancelled"
  );
}

function getMetafields(task: GsmTaskRecord | null): Record<string, unknown> {
  const metafields = getRecord(task?.metafields);
  return metafields ?? {};
}

function getTaskState(task: GsmTaskRecord | null) {
  return getTrimmedString(task?.state);
}

// Only "active" and "completed" are valid status transitions from GSM.
// "completed" is handled separately via allCompleted + canAutoComplete.
function mapStatus(state?: string | null) {
  const value = normalizeGsmState(state);
  if (
    value === "active" ||
    value === "transit" ||
    value === "accepted" ||
    value === "assigned"
  ) {
    return "active";
  }
  return null;
}

function getNextStatus(input: {
  allCompleted: boolean;
  canAutoComplete: boolean;
  currentStatus: string | null;
  decisionState: string | null;
}) {
  if (input.allCompleted && input.canAutoComplete) {
    return "completed";
  }
  const mapped = mapStatus(input.decisionState);
  if (mapped) {
    return mapped;
  }
  return input.currentStatus;
}

// GSM task assignee name — the driver who actually performed the task.
function getGsmAssigneeName(task: GsmTaskRecord | null): string | null {
  if (!task) return null;
  return getFirstNonEmptyString(task.assignee_name);
}

// GSM subcontractor company name — stored in metafields["sub:contr"].
function getGsmSubcontractorName(task: GsmTaskRecord | null): string | null {
  if (!task) return null;
  const metafields = getMetafields(task);
  return getFirstNonEmptyString(metafields["sub:contr"]);
}

function normalizeForSubcontractorMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9æøå]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatchSubcontractor(username: string, gsmName: string): boolean {
  const a = normalizeForSubcontractorMatch(username);
  const b = normalizeForSubcontractorMatch(gsmName);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}


function syncPodPdfInBackground(orderId: string, gsmTaskId: string) {
  void syncPodPdfWithRetry(orderId, gsmTaskId).catch((error: unknown) => {
    console.error("POD IMPORT FAILED:", {
      orderId,
      gsmTaskId,
      error,
    });
  });
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-otman-secret");
    const expected = process.env.GSM_WEBHOOK_SECRET;

    if (!expected || secret !== expected) {
      return NextResponse.json(
        { ok: false, reason: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const raw = await req.text();
    const body = JSON.parse(raw) as Record<string, unknown>;

    const rawTask = getRecord(body.task) ?? getRecord(body.object);

    const gsmTaskId =
      typeof rawTask?.id === "string"
        ? rawTask.id
        : typeof body.task_id === "string"
          ? body.task_id
          : null;

    const webhookState =
      typeof rawTask?.state === "string"
        ? rawTask.state
        : typeof body.to_state === "string"
          ? body.to_state
          : typeof body.state === "string"
            ? body.state
            : null;

    // Always fetch fresh task so we have the latest state and full field set
    let fullTask: GsmTaskRecord | null = rawTask;
    let freshTaskState: string | null = null;

    if (gsmTaskId) {
      try {
        const freshTask = await fetchGsmTask(gsmTaskId);
        fullTask = freshTask;
        freshTaskState = getTaskState(freshTask);
      } catch (error) {
        console.error("FAILED TO FETCH FULL GSM TASK:", gsmTaskId, error);
      }
    }

    const taskState = freshTaskState ?? webhookState;

    const externalId = getFirstNonEmptyString(
      rawTask?.external_id,
      fullTask?.external_id,
    );

    let orderId: string | null = null;

    if (typeof externalId === "string" && externalId.startsWith("order:")) {
      orderId = externalId.replace("order:", "");
    }

    if (!orderId && gsmTaskId) {
      const existing = await prisma.orderGsmTask.findUnique({
        where: { gsmTaskId },
        select: { orderId: true },
      });

      if (existing) {
        orderId = existing.orderId;
      }
    }

    const event = await prisma.gsmWebhookEvent.create({
      data: {
        gsmRequestId: req.headers.get("x-gsmtasks-webhook-request-id"),
        gsmTaskId,
        topic: req.headers.get("x-gsmtasks-topic"),
        eventType: req.headers.get("x-gsmtasks-topic"),
        payload: body as Prisma.InputJsonValue,
        orderId,
        processed: false,
      },
    });

    if (!orderId) {
      await prisma.gsmWebhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processingError: "ORDER_NOT_FOUND",
          processedAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true });
    }

    // Driver notes live on the task_event (body.notes), not on the task object itself.
    const eventNotes = getTrimmedString(body.notes);

    if (gsmTaskId) {
      await prisma.orderGsmTask.upsert({
        where: { gsmTaskId },
        update: {
          state: taskState,
          lastWebhookAt: new Date(),
          rawPayload: body as Prisma.InputJsonValue,
          // Only ever set hasNotes to true — never reset it. Once a task event
          // has notes it requires manual review regardless of later webhooks.
          ...(eventNotes ? { hasNotes: true } : {}),
        },
        create: {
          orderId,
          gsmTaskId,
          state: taskState,
          lastWebhookAt: new Date(),
          rawPayload: body as Prisma.InputJsonValue,
          hasNotes: !!eventNotes,
        },
      });
    }

    const orderBeforeUpdate = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        companyId: true,
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
        subcontractorMembershipId: true,
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
        gsmOrderId: true,
        gsmLastTaskState: true,
      },
    });

    if (!orderBeforeUpdate) {
      await prisma.gsmWebhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processingError: "ORDER_NOT_FOUND",
          processedAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true });
    }

    // POD is per task — sync whenever a task completes regardless of order status
    if (gsmTaskId && taskState === "completed") {
      syncPodPdfInBackground(orderId, gsmTaskId);
    }

    const tasks = await prisma.orderGsmTask.findMany({
      where: { orderId },
      select: { state: true, hasNotes: true },
    });

    const allCompleted =
      tasks.length > 0 && tasks.every((task) => task.state === "completed");

    // If ANY task across this order had driver notes (current or prior events),
    // auto-complete must be blocked. hasNotes is written at upsert time and never reset.
    const anyTaskHasNotes = tasks.some((task) => task.hasNotes);

    // If the task was previously failed and is now being completed, always require
    // manual review — something went wrong on a prior attempt.
    const fromState = getTrimmedString(body.from_state);
    const completedAfterFailure =
      taskState === "completed" && fromState === "failed";

    // Auto-complete is blocked when any task has notes, or when the task was
    // completed after a prior failure.
    const blockingContent = anyTaskHasNotes || completedAfterFailure;

    const normalizedTaskState = normalizeGsmState(taskState);
    const isCancelledOrFailed =
      normalizedTaskState === "cancelled" ||
      normalizedTaskState === "cancel" ||
      normalizedTaskState === "failed" ||
      normalizedTaskState === "fail";

    if (allCompleted && blockingContent) {
      console.info("GSM AUTO-COMPLETE BLOCKED:", {
        orderId,
        orderNumber: orderBeforeUpdate.orderNumber,
        gsmTaskId,
        reason: completedAfterFailure
          ? "Task completed after a prior failure — manual review required"
          : "Driver left a note requiring manual review",
      });
    }

    const metafields = getMetafields(fullTask);

    const nextStatus = getNextStatus({
      allCompleted,
      canAutoComplete: !blockingContent,
      currentStatus: orderBeforeUpdate.status,
      decisionState: taskState,
    });

    const driverValue = getFirstNonEmptyString(
      getGsmAssigneeName(fullTask),
      metafields["app:name"],
      metafields.driver,
      orderBeforeUpdate.driver,
    );

    const secondDriverValue = getFirstNonEmptyString(
      metafields["app:driver2"],
      metafields.driver2,
      orderBeforeUpdate.secondDriver,
    );
    const licensePlateValue = getFirstNonEmptyString(
      metafields["app:carnumber"],
      metafields.carnumber,
      orderBeforeUpdate.licensePlate,
    );

    // Subcontractor: fuzzy-match GSM company name against user profiles in this company
    let nextSubcontractorMembershipId: string | undefined = undefined;
    let nextSubcontractor: string | undefined = undefined;

    const gsmSubName = getGsmSubcontractorName(fullTask);
    if (gsmSubName) {
      const memberships = await prisma.membership.findMany({
        where: { companyId: orderBeforeUpdate.companyId, status: "ACTIVE" },
        select: { id: true, user: { select: { username: true } } },
      });
      const matched = memberships.find(
        (m) => m.user.username && fuzzyMatchSubcontractor(m.user.username, gsmSubName),
      );
      if (matched) {
        nextSubcontractorMembershipId = matched.id;
        nextSubcontractor = gsmSubName;
      }
    }

    const shouldClearRabatt = shouldClearCancelledDiscount(
      orderBeforeUpdate.status,
      nextStatus,
    );
    const nextRabatt = shouldClearRabatt ? null : orderBeforeUpdate.rabatt;
    const nextSubcontractorMinus = shouldClearRabatt
      ? null
      : orderBeforeUpdate.subcontractorMinus;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        driver: driverValue ?? undefined,
        secondDriver: secondDriverValue ?? undefined,
        licensePlate: licensePlateValue ?? undefined,
        subcontractor: nextSubcontractor,
        subcontractorMembershipId: nextSubcontractorMembershipId,
        gsmLastTaskState: taskState ?? undefined,
        gsmLastWebhookAt: new Date(),
        status: nextStatus ?? undefined,
        rabatt: shouldClearRabatt ? nextRabatt : undefined,
        subcontractorMinus: shouldClearRabatt ? nextSubcontractorMinus : undefined,
      },
    });

    const previousSnapshot = buildOrderEventSnapshot(orderBeforeUpdate);
    const nextSnapshot = buildOrderEventSnapshot({
      ...orderBeforeUpdate,
      driver: driverValue,
      secondDriver: secondDriverValue,
      licensePlate: licensePlateValue,
      subcontractor: nextSubcontractor ?? orderBeforeUpdate.subcontractor,
      gsmLastTaskState: taskState ?? orderBeforeUpdate.gsmLastTaskState,
      status: nextStatus,
      rabatt: nextRabatt,
      subcontractorMinus: nextSubcontractorMinus,
    });
    const changes = diffOrderEventSnapshots(previousSnapshot, nextSnapshot);

    if (changes.length === 1 && changes[0]?.field === "status") {
      await createOrderStatusChangedEvent(prisma, {
        orderId,
        companyId: orderBeforeUpdate.companyId,
        actor: {
          name: "GSM webhook",
          email: null,
          source: "GSM_WEBHOOK",
        },
        fromStatus: previousSnapshot.status,
        toStatus: nextSnapshot.status,
      });
    } else if (changes.length > 0) {
      await createOrderUpdatedEvent(prisma, {
        orderId,
        companyId: orderBeforeUpdate.companyId,
        actor: {
          name: "GSM webhook",
          email: null,
          source: "GSM_WEBHOOK",
        },
        changes,
      });
    }

    if (allCompleted && blockingContent) {
      await createOrderActionEvent(prisma, {
        orderId,
        companyId: orderBeforeUpdate.companyId,
        actor: {
          name: "GSM webhook",
          email: null,
          source: "GSM_WEBHOOK",
        },
        title: "Auto-complete blocked — manual review required",
        details: [
          "All GSM tasks are completed, but the driver left a note that requires manual review before the order can be marked complete.",
        ],
      });
    }

    if (isCancelledOrFailed) {
      await createOrderActionEvent(prisma, {
        orderId,
        companyId: orderBeforeUpdate.companyId,
        actor: {
          name: "GSM webhook",
          email: null,
          source: "GSM_WEBHOOK",
        },
        title: `GSM task ${normalizedTaskState} — manual review required`,
        details: [
          `Task ${gsmTaskId ?? "unknown"} was marked as ${taskState} in GSM. The order has not been automatically completed and requires manual review.`,
        ],
      });
    }

    await prisma.gsmWebhookEvent.update({
      where: { id: event.id },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("GSM WEBHOOK ERROR:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
