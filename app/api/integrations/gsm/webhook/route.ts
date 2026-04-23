// path: app/api/integrations/gsm/webhook/route.ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchGsmTask } from "@/lib/integrations/gsm/fetchTask";
import { syncPodPdfWithRetry } from "@/lib/integrations/gsm/downloadPodPdf";
import {
  buildOrderEventSnapshot,
  createOrderStatusChangedEvent,
  createOrderUpdatedEvent,
  diffOrderEventSnapshots,
} from "@/lib/orders/orderEvents";

function mapStatus(state?: string | null) {
  const value = (state ?? "").toLowerCase();

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

function getFirstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    const trimmed = getTrimmedString(value);

    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function getMetafields(task: GsmTaskRecord | null): Record<string, unknown> {
  const metafields = getRecord(task?.metafields);
  return metafields ?? {};
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

    const externalId =
      typeof rawTask?.external_id === "string" ? rawTask.external_id : null;

    let fullTask: GsmTaskRecord | null = rawTask;

    if (gsmTaskId) {
      try {
        fullTask = await fetchGsmTask(gsmTaskId);
      } catch (error) {
        console.error("FAILED TO FETCH FULL GSM TASK:", gsmTaskId, error);
      }
    }

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

    if (gsmTaskId) {
      await prisma.orderGsmTask.upsert({
        where: { gsmTaskId },
        update: {
          state,
          lastWebhookAt: new Date(),
          rawPayload: body as Prisma.InputJsonValue,
        },
        create: {
          orderId,
          gsmTaskId,
          state,
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
        feeAddToOrder: true,
        dontSendEmail: true,
        priceExVat: true,
        priceSubcontractor: true,
        rabatt: true,
        leggTil: true,
        subcontractorMinus: true,
        subcontractorPlus: true,
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

    // Import only POD PDF, with delay + retry, after completion
    if (gsmTaskId && state === "completed") {
      try {
        await syncPodPdfWithRetry(orderId, gsmTaskId);
      } catch (error) {
        console.error("POD IMPORT FAILED:", {
          orderId,
          gsmTaskId,
          error,
        });
      }
    }

    const tasks = await prisma.orderGsmTask.findMany({
      where: { orderId },
      select: { state: true },
    });

    const allCompleted =
      tasks.length > 0 && tasks.every((task) => task.state === "completed");

    const mapped = mapStatus(state);
    const nextStatus = allCompleted
      ? "completed"
      : mapped ?? orderBeforeUpdate.status;

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

    await prisma.order.update({
      where: { id: orderId },
      data: {
        driver: driverValue ?? undefined,
        secondDriver: secondDriverValue ?? undefined,
        licensePlate: licensePlateValue ?? undefined,
        statusNotes: statusNotesValue ?? undefined,
        gsmLastTaskState: state ?? undefined,
        gsmLastWebhookAt: new Date(),
        status: nextStatus ?? undefined,
      },
    });

    const previousSnapshot = buildOrderEventSnapshot(orderBeforeUpdate);
    const nextSnapshot = buildOrderEventSnapshot({
      ...orderBeforeUpdate,
      driver: driverValue,
      secondDriver: secondDriverValue,
      licensePlate: licensePlateValue,
      statusNotes: statusNotesValue,
      gsmLastTaskState: state ?? orderBeforeUpdate.gsmLastTaskState,
      status: nextStatus,
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
