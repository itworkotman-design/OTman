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
  membershipFindManyMock: vi.fn(),
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
    membership: {
      findMany: mocks.membershipFindManyMock,
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
    subcontractorMembershipId: null,
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
    mocks.membershipFindManyMock.mockResolvedValue([]);
    mocks.buildOrderEventSnapshotMock.mockImplementation((value) => value);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([
      { field: "driver" },
    ]);
    mocks.createOrderActionEventMock.mockResolvedValue(undefined);
    mocks.createOrderStatusChangedEventMock.mockResolvedValue(undefined);
    mocks.createOrderUpdatedEventMock.mockResolvedValue(undefined);
    mocks.syncPodPdfWithRetryMock.mockResolvedValue(undefined);
  });

  it("stores returned drivers and license plate on the order", async () => {
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
        gsmLastTaskState: "active",
        status: "active",
      }),
    });
    expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.createOrderStatusChangedEventMock).not.toHaveBeenCalled();
  });

  it("does not change order status for failed GSM task state", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "fail",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "fail" }]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([{ field: "gsmLastTaskState" }]);

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
        status: "processing", // unchanged
      }),
    });
    expect(mocks.createOrderStatusChangedEventMock).not.toHaveBeenCalled();
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ title: "GSM task fail — manual review required" }),
    );
  });

  it("does not change order status for cancelled GSM task state", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "cancelled",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "cancelled" }]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([{ field: "gsmLastTaskState" }]);

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
        gsmLastTaskState: "cancelled",
        status: "processing", // unchanged
      }),
    });
    expect(mocks.createOrderStatusChangedEventMock).not.toHaveBeenCalled();
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ title: "GSM task cancelled — manual review required" }),
    );
  });

  it("sets status to active when fresh task is assigned (even if webhook said cancelled)", async () => {
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
    expect(mocks.createOrderActionEventMock).not.toHaveBeenCalled();
  });

  it("clears discount when GSM moves a cancelled order back to active", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue({
      ...buildOrderBeforeUpdate(),
      status: "cancelled",
      rabatt: "500",
      subcontractorMinus: "300",
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
      { field: "subcontractorMinus" },
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
        subcontractorMinus: null,
      }),
    });
    expect(mocks.buildOrderEventSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        rabatt: null,
        subcontractorMinus: null,
      }),
    );
  });

  it("does not auto-complete when task has driver notes", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "completed",
      documents: [],
      signatures: [],
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "completed" }]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([{ field: "gsmLastTaskState" }]);

    // Driver notes come at the task_event level (body.notes), not on the task object
    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: { id: "task-1", external_id: "order:order-1", state: "completed" },
          to_state: "completed",
          notes: "Customer was not home",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        status: "processing", // not completed — blocked by note
      }),
    });
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        title: "Auto-complete blocked — manual review required",
      }),
    );
  });

  it("auto-completes even when task has documents and signatures (POD artifacts are not blockers)", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "completed",
      documents: ["https://api.gsmtasks.com/documents/doc-1/"],
      signatures: ["https://api.gsmtasks.com/signatures/sig-1/"],
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "completed" }]);
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
          task: { id: "task-1", external_id: "order:order-1", state: "completed" },
          to_state: "completed",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "completed" }),
    });
    expect(mocks.createOrderActionEventMock).not.toHaveBeenCalled();
  });

  it("auto-completes when all tasks are completed and there are no driver notes", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "completed",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([{ state: "completed" }]);
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
          task: { id: "task-1", external_id: "order:order-1", state: "completed" },
          to_state: "completed",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "completed" }),
    });
    expect(mocks.createOrderActionEventMock).not.toHaveBeenCalled();
  });

  it("does not auto-complete when one task is still pending", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "completed",
      metafields: {},
    });
    mocks.orderGsmTaskFindManyMock.mockResolvedValue([
      { state: "completed" },
      { state: "active" },
    ]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([{ field: "gsmLastTaskState" }]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: { id: "task-1", external_id: "order:order-1", state: "completed" },
          to_state: "completed",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "processing" }),
    });
  });

  it("fuzzy-matches GSM subcontractor name to a membership and sets it on the order", async () => {
    mocks.fetchGsmTaskMock.mockResolvedValue({
      id: "task-1",
      external_id: "order:order-1",
      state: "active",
      metafields: { "sub:contr": "Transport AS" },
    });
    mocks.membershipFindManyMock.mockResolvedValue([
      { id: "membership-sub-1", user: { username: "Transport AS" } },
      { id: "membership-sub-2", user: { username: "Other Company" } },
    ]);
    mocks.diffOrderEventSnapshotsMock.mockReturnValue([{ field: "subcontractor" }]);

    const response = await POST(
      new Request("http://localhost/api/integrations/gsm/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-secret": "test-secret",
          "x-gsmtasks-topic": "taskevent.create",
        },
        body: JSON.stringify({
          task: { id: "task-1", external_id: "order:order-1", state: "active" },
          to_state: "active",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        subcontractor: "Transport AS",
        subcontractorMembershipId: "membership-sub-1",
      }),
    });
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
