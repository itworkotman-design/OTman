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

function isCancelledState(state?: string | null) {
  const value = normalizeGsmState(state);
  return value === "cancelled" || value === "canceled";
}

const NON_CANCELLING_EVENTS = new Set(["unassign", "assign", "reject"]);

function mapStatus(state?: string | null) {
  const value = normalizeGsmState(state);

  if (value === "failed" || value === "fail") return "failed";
  if (value === "cancelled" || value === "canceled") return "cancelled";
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

function getNextStatus(input: {
  allCompleted: boolean;
  currentStatus: string | null;
  decisionState: string | null;
}) {
  if (input.allCompleted) {
    return "completed";
  }

  const mapped = mapStatus(input.decisionState);

  if (mapped) {
    return mapped;
  }

  return input.currentStatus;
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

    const state =
      typeof rawTask?.state === "string"
        ? rawTask.state
        : typeof body.to_state === "string"
          ? body.to_state
          : typeof body.state === "string"
            ? body.state
            : null;

    const eventAction = getEventAction(body);
    const eventActionBlocksCancellation = eventAction !== null && NON_CANCELLING_EVENTS.has(eventAction);

    let fullTask: GsmTaskRecord | null = rawTask;
    let freshTask: GsmTaskRecord | null = null;
    let freshTaskState: string | null = null;

    if (gsmTaskId) {
      try {
        freshTask = await fetchGsmTask(gsmTaskId);
        fullTask = freshTask;
        freshTaskState = getTaskState(freshTask);
      } catch (error) {
        console.error("FAILED TO FETCH FULL GSM TASK:", gsmTaskId, error);
      }
    }

    const externalId = getFirstNonEmptyString(
      rawTask?.external_id,
      freshTask?.external_id,
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

    let taskStateForStorage = state;
    let statusDecisionState = state;
    let cancellationDecision:
      | "not_cancelled_webhook"
      | "verified_cancelled"
      | "transient_cancelled_ignored"
      | "unverified_cancelled_ignored" = "not_cancelled_webhook";

    if (isCancelledState(state) && !eventActionBlocksCancellation) {
      if (freshTaskState) {
        taskStateForStorage = freshTaskState;
        statusDecisionState = freshTaskState;
        cancellationDecision = isCancelledState(freshTaskState) ? "verified_cancelled" : "transient_cancelled_ignored";
      } else {
        statusDecisionState = null;
        cancellationDecision = "unverified_cancelled_ignored";
      }
    } else if (isCancelledState(state) && eventActionBlocksCancellation) {
      statusDecisionState = null;
      taskStateForStorage = freshTaskState ?? state;
      cancellationDecision = "transient_cancelled_ignored";
    }

    if (gsmTaskId) {
      await prisma.orderGsmTask.upsert({
        where: { gsmTaskId },
        update: {
          state: taskStateForStorage,
          lastWebhookAt: new Date(),
          rawPayload: body as Prisma.InputJsonValue,
        },
        create: {
          orderId,
          gsmTaskId,
          state: taskStateForStorage,
          lastWebhookAt: new Date(),
          rawPayload: body as Prisma.InputJsonValue,
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

    const metafields = getMetafields(fullTask);

    if (gsmTaskId && state === "completed") {
      syncPodPdfInBackground(orderId, gsmTaskId);
    }

    const tasks = await prisma.orderGsmTask.findMany({
      where: { orderId },
      select: { state: true },
    });

    const allCompleted =
      tasks.length > 0 && tasks.every((task) => task.state === "completed");

    const nextStatus = getNextStatus({
      allCompleted,
      currentStatus: orderBeforeUpdate.status,
      decisionState: statusDecisionState,
    });

    if (cancellationDecision !== "not_cancelled_webhook") {
      console.info("GSM WEBHOOK CANCELLATION DECISION:", {
        orderId,
        orderNumber: orderBeforeUpdate.orderNumber,
        displayId: orderBeforeUpdate.displayId,
        gsmOrderId: orderBeforeUpdate.gsmOrderId,
        webhookState: state,
        freshGsmState: freshTaskState,
        eventAction,
        eventActionBlocksCancellation,
        finalDecision: cancellationDecision,
        decisionText: cancellationDecision === "verified_cancelled" ? "verified GSM cancellation applied" : "ignored unverified GSM cancellation",
        finalStatus: nextStatus,
      });
    }

    const driverValue = getFirstNonEmptyString(
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
    const statusNotesValue = getFirstNonEmptyString(
      body.notes,
      metafields["app:status_notes"],
      metafields.status_notes,
      orderBeforeUpdate.statusNotes,
    );
    const shouldClearRabatt = shouldClearCancelledDiscount(
      orderBeforeUpdate.status,
      nextStatus,
    );

    await prisma.order.update({
      where: { id: orderId },
      data: {
        driver: driverValue ?? undefined,
        secondDriver: secondDriverValue ?? undefined,
        licensePlate: licensePlateValue ?? undefined,
        statusNotes: statusNotesValue ?? undefined,
        gsmLastTaskState: taskStateForStorage ?? undefined,
        gsmLastWebhookAt: new Date(),
        status: nextStatus ?? undefined,
        rabatt: shouldClearRabatt ? null : undefined,
      },
    });

    const previousSnapshot = buildOrderEventSnapshot(orderBeforeUpdate);
    const nextSnapshot = buildOrderEventSnapshot({
      ...orderBeforeUpdate,
      driver: driverValue,
      secondDriver: secondDriverValue,
      licensePlate: licensePlateValue,
      statusNotes: statusNotesValue,
      gsmLastTaskState: taskStateForStorage ?? orderBeforeUpdate.gsmLastTaskState,
      status: nextStatus,
      rabatt: shouldClearRabatt ? null : orderBeforeUpdate.rabatt,
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
    } else {
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

    if (
      cancellationDecision === "transient_cancelled_ignored" ||
      cancellationDecision === "unverified_cancelled_ignored"
    ) {
      await createOrderActionEvent(prisma, {
        orderId,
        companyId: orderBeforeUpdate.companyId,
        actor: {
          name: "GSM webhook",
          email: null,
          source: "GSM_WEBHOOK",
        },
        title: "Ignored unverified GSM cancellation",
        details: [
          `Webhook state: ${state ?? "-"}`,
          `Fresh GSM state: ${freshTaskState ?? "-"}`,
          `Decision: ignored unverified GSM cancellation`,
          `Final status: ${nextStatus ?? "-"}`,
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
