import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchGsmTaskMock: vi.fn(),
  syncPodPdfWithRetryMock: vi.fn(),
  buildOrderEventSnapshotMock: vi.fn(),
  diffOrderEventSnapshotsMock: vi.fn(),
  createOrderActionEventMock: vi.fn(),
  createOrderStatusChangedEventMock: vi.fn(),
  createOrderUpdatedEventMock: vi.fn(),
  orderGsmTaskFindUniqueMock: vi.fn(),
  orderGsmTaskUpsertMock: vi.fn(),
  orderGsmTaskFindManyMock: vi.fn(),
  gsmWebhookEventCreateMock: vi.fn(),
  gsmWebhookEventUpdateMock: vi.fn(),
  orderFindUniqueMock: vi.fn(),
  orderUpdateMock: vi.fn(),
}));

vi.mock("@/lib/integrations/gsm/fetchTask", () => ({
  fetchGsmTask: mocks.fetchGsmTaskMock,
}));

vi.mock("@/lib/integrations/gsm/downloadPodPdf", () => ({
  syncPodPdfWithRetry: mocks.syncPodPdfWithRetryMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  buildOrderEventSnapshot: mocks.buildOrderEventSnapshotMock,
  diffOrderEventSnapshots: mocks.diffOrderEventSnapshotsMock,
  createOrderActionEvent: mocks.createOrderActionEventMock,
  createOrderStatusChangedEvent: mocks.createOrderStatusChangedEventMock,
  createOrderUpdatedEvent: mocks.createOrderUpdatedEventMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    orderGsmTask: {
      findUnique: mocks.orderGsmTaskFindUniqueMock,
      upsert: mocks.orderGsmTaskUpsertMock,
      findMany: mocks.orderGsmTaskFindManyMock,
    },
    gsmWebhookEvent: {
      create: mocks.gsmWebhookEventCreateMock,
      update: mocks.gsmWebhookEventUpdateMock,
    },
    order: {
      findUnique: mocks.orderFindUniqueMock,
      update: mocks.orderUpdateMock,
    },
  },
}));

import { POST } from "./route";

function buildOrderBeforeUpdate() {
  return {
    id: "order-1",
    companyId: "company-1",
    displayId: 20001,
    orderNumber: "A-1",
    status: "processing",
    statusNotes: "",
    customerLabel: "Customer",
    customerName: "Customer Name",
    deliveryDate: "2026-04-20",
    timeWindow: "10:00-16:00",
    pickupAddress: "Pickup 1",
    extraPickupAddress: [],
    deliveryAddress: "Delivery 1",
    returnAddress: "",
    drivingDistance: "25 km",
    phone: "12345678",
    phoneTwo: "",
    email: "customer@example.com",
    customerComments: "",
    description: "",
    productsSummary: "Product",
    deliveryTypeSummary: "Indoor",
    servicesSummary: "",
    cashierName: "",
    cashierPhone: "",
    subcontractor: "",
    driver: "",
    secondDriver: "",
    driverInfo: "",
    licensePlate: "",
    deviation: "",
    feeExtraWork: false,
    feeAddToOrder: false,
    dontSendEmail: false,
    priceExVat: 0,
    priceSubcontractor: 0,
    rabatt: "",
    leggTil: "",
    subcontractorMinus: "",
    subcontractorPlus: "",
    gsmOrderId: "gsm-order-1",
    gsmLastTaskState: "",
  };
}

describe("POST /api/integrations/gsm/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GSM_WEBHOOK_SECRET = "test-secret";
    mocks.gsmWebhookEventCreateMock.mockResolvedValue({ id: "event-1" });
    mocks.gsmWebhookEventUpdateMock.mockResolvedValue(undefined);
    mocks.orderGsmTaskFindUniqueMock.mockResolvedValue(null);
    mocks.orderGsmTaskUpsertMock.mockResolvedValue(undefined);
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "active" }]);
    mocks.orderFindUniqueMock.mockResolvedValue(buildOrderBeforeUpdate());
    mocks.orderUpdateMock.mockResolvedValue({ id: "order-1" });
    mocks.buildOrderEventSnapshotMock.mockImplementation((value) => value);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([
      { field: "statusNotes" },
      { field: "driver" },
    ]);
    mocks.createOrderActionEventMock.mockResolvedValue(undefined);
    mocks.createOrderStatusChangedEventMock.mockResolvedValue(undefined);
    mocks.createOrderUpdatedEventMock.mockResolvedValue(undefined);
    mocks.syncPodPdfWithRetryMock.mockResolvedValue(undefined);
  });

  it("stores returned drivers, license plate, and webhook notes on the order", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "active",
      metafields: {
        "app:name": "Driver One",
        "app:driver2": "Driver Two",
        "app:carnumber": "AB12345",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
          "x-gsmtasks-webhook-request-id": "request-1",
        },
        body: JSON.stringify({
          task: {
            id: "task-1",
            external_id: "order:order-1",
            state: "active",
          },
          to_state: "active",
          notes: "Left in reception",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        driver: "Driver One",
        secondDriver: "Driver Two",
        licensePlate: "AB12345",
        statusNotes: "Left in reception",
        gsmLastTaskState: "active",
        status: "active",
      }),
    });
    expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.createOrderStatusChangedEventMock).not.toHaveBeenCalled();
  });

  it("does not overwrite status notes with blank webhook notes", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({
      ...buildOrderBeforeUpdate(),
      statusNotes: "Keep this note",
      driver: "Existing Driver",
    });
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "active",
      metafields: {
        "app:name": "Existing Driver",
      },
    });
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: {
            id: "task-1",
            external_id: "order:order-1",
            state: "active",
          },
          notes: "   ",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        driver: "Existing Driver",
        statusNotes: "Keep this note",
      }),
    });
  });

  it("normalizes fail webhook states to failed", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "fail",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "fail" }]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([{ field: "status" }]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: {
            id: "task-1",
            external_id: "order:order-1",
            state: "fail",
          },
          to_state: "fail",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        gsmLastTaskState: "fail",
        status: "failed",
      }),
    });
    expect(mocks.createOrderStatusChangedEventMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        orderId: "order-1",
        fromStatus: "processing",
        toStatus: "failed",
      }),
    );
  });

  it("cancels the order when webhook cancelled is verified by fresh GSM state", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "cancelled",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "cancelled" }]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([{ field: "status" }]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: {
            id: "task-1",
            external_id: "order:order-1",
            state: "cancelled",
          },
          to_state: "cancelled",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderGsmTaskUpsertMock).toHaveBeenCalledWith({
      where: { gsmTaskId: "task-1" },
      update: expect.objectContaining({
        state: "cancelled",
      }),
      create: expect.objectContaining({
        state: "cancelled",
      }),
    });
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        gsmLastTaskState: "cancelled",
        status: "cancelled",
      }),
    });
    expect(mocks.createOrderActionEventMock).not.toHaveBeenCalled();
  });

  it("does not cancel when webhook cancelled is contradicted by fresh unassigned GSM state", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "unassigned",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "unassigned" }]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([
      { field: "gsmLastTaskState" },
    ]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: {
            id: "task-1",
            external_id: "order:order-1",
            state: "cancelled",
          },
          to_state: "cancelled",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderGsmTaskUpsertMock).toHaveBeenCalledWith({
      where: { gsmTaskId: "task-1" },
      update: expect.objectContaining({
        state: "unassigned",
      }),
      create: expect.objectContaining({
        state: "unassigned",
      }),
    });
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        gsmLastTaskState: "unassigned",
        status: "processing",
      }),
    });
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        orderId: "order-1",
        title: "Ignored unverified GSM cancellation",
        details: expect.arrayContaining([
          "Webhook state: cancelled",
          "Fresh GSM state: unassigned",
          "Decision: ignored unverified GSM cancellation",
          "Final status: processing",
        ]),
      }),
    );
  });

  it("marks the order active when webhook cancelled is contradicted by fresh assigned GSM state", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "assigned",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "assigned" }]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([{ field: "status" }]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: {
            id: "task-1",
            external_id: "order:order-1",
            state: "cancelled",
          },
          to_state: "cancelled",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        gsmLastTaskState: "assigned",
        status: "active",
      }),
    });
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        title: "Ignored unverified GSM cancellation",
        details: expect.arrayContaining([
          "Webhook state: cancelled",
          "Fresh GSM state: assigned",
          "Decision: ignored unverified GSM cancellation",
          "Final status: active",
        ]),
      }),
    );
  });

  it("clears discount when GSM moves a cancelled order back to active", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({
      ...buildOrderBeforeUpdate(),
      status: "cancelled",
      rabatt: "500",
    });
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "assigned",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "assigned" }]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([
      { field: "status" },
      { field: "rabatt" },
    ]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: {
            id: "task-1",
            external_id: "order:order-1",
            state: "assigned",
          },
          to_state: "assigned",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        gsmLastTaskState: "assigned",
        status: "active",
        rabatt: null,
      }),
    });
    expect(mocks.buildOrderEventSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        rabatt: null,
      }),
    );
  });

  it("does not reactivate a cancelled order from an unassigned follow-up without a false-cancellation marker", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({
      ...buildOrderBeforeUpdate(),
      status: "cancelled",
      gsmLastTaskState: "cancelled",
    });
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "unassigned",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "unassigned" }]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([
      { field: "gsmLastTaskState" },
    ]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: {
            id: "task-1",
            external_id: "order:order-1",
            state: "unassigned",
          },
          to_state: "unassigned",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        gsmLastTaskState: "unassigned",
        status: "cancelled",
      }),
    });
    expect(mocks.createOrderStatusChangedEventMock).not.toHaveBeenCalled();
  });

  it("does not wait for POD sync before acknowledging completed webhooks", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "completed",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "completed" }]);
    mocks.syncPodPdfWithRetryMock.mockReturnValue(
      new Promise<never>(() => undefined),
    );
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([{ field: "status" }]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: {
            id: "task-1",
            external_id: "order:order-1",
            state: "completed",
          },
          to_state: "completed",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.syncPodPdfWithRetryMock).toHaveBeenCalledWith(
      "order-1",
      "task-1",
    );
    expect(mocks.gsmWebhookEventUpdateMock).toHaveBeenLastCalledWith({
      where: { id: "event-1" },
      data: {
        processed: true,
        processedAt: expect.any(Date),
      },
    });
  });
});
