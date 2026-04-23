import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchGsmTaskMock: vi.fn(),
  syncPodPdfWithRetryMock: vi.fn(),
  buildOrderEventSnapshotMock: vi.fn(),
  diffOrderEventSnapshotsMock: vi.fn(),
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
});
