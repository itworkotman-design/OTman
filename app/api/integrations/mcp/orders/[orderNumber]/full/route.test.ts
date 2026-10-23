import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: mocks.orderFindUniqueMock,
    },
  },
}));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest(
  orderNumber: string,
  apiKey = API_KEY,
  companyId = COMPANY_ID,
) {
  return GET(
    new Request(
      `http://localhost/api/integrations/mcp/orders/${orderNumber}/full`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Otman-Company-Id": companyId,
        },
      },
    ),
    { params: Promise.resolve({ orderNumber }) },
  );
}

function buildOrderRow() {
  return {
    id: "order-cuid",
    companyId: COMPANY_ID,
    displayId: 42,
    orderNumber: "CUSTOMER-REF",
    status: "Bekreftet",
    statusNotes: "Called customer",
    customerComments: "Ring on arrival",
    driver: "Ola",
    secondDriver: "Kari",
    driverInfo: "Use back door",
    deviation: "Scratch on door",
    phone: "+4712345678",
    email: "customer@example.com",
    priceExVat: 1200,
    priceSubcontractor: 800,
    actionToken: "secret-action-token",
    emailThreadToken: "secret-thread-token",
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
    updatedAt: new Date("2026-09-21T11:00:00.000Z"),
    createdByMembership: {
      role: "ADMIN",
      user: { username: "Creator", email: "creator@example.com" },
    },
    lastEditedByMembership: null,
    customerMembership: null,
    events: [
      {
        id: "event-1",
        type: "STATUS_CHANGED",
        actorName: "Dispatcher",
        actorEmail: "dispatch@example.com",
        actorSource: "dashboard",
        payload: { fromStatus: "pending", toStatus: "confirmed" },
        createdAt: new Date("2026-09-21T11:00:00.000Z"),
      },
    ],
    emailMessages: [
      {
        id: "email-1",
        direction: "INBOUND",
        subject: "Re: order 42",
        bodyText: "Thanks!",
        createdAt: new Date("2026-09-21T12:00:00.000Z"),
      },
    ],
    notifications: [],
    items: [],
    orderAttachments: [
      {
        id: "att-1",
        filename: "pod.pdf",
        storagePath: "orders/order-cuid/pod.pdf",
        category: "POD",
      },
    ],
    gsmTasks: [
      { id: "task-1", state: "completed", hasNotes: true, rawPayload: {} },
    ],
  };
}

describe("GET /api/integrations/mcp/orders/[orderNumber]/full", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OTMAN_API_KEY = API_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.OTMAN_API_KEY;
    } else {
      process.env.OTMAN_API_KEY = originalApiKey;
    }

    if (originalCompanyId === undefined) {
      delete process.env.OTMAN_API_COMPANY_ID;
    } else {
      process.env.OTMAN_API_COMPANY_ID = originalCompanyId;
    }
  });

  it("fails closed when service authentication is not configured", async () => {
    delete process.env.OTMAN_API_KEY;

    const response = await createRequest("42");

    expect(response.status).toBe(503);
    expect(mocks.orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid service API key", async () => {
    const response = await createRequest("42", "wrong-api-key");

    expect(response.status).toBe(401);
    expect(mocks.orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it("enforces the configured fixed company boundary", async () => {
    const response = await createRequest("42", API_KEY, "another-company");

    expect(response.status).toBe(403);
    expect(mocks.orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid display order number", async () => {
    const response = await createRequest("0");

    expect(response.status).toBe(400);
    expect(mocks.orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the exact display ID does not exist", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue(null);

    const response = await createRequest("42");

    expect(response.status).toBe(404);
  });

  it("returns every order field plus history, emails, attachments and GSM tasks", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue(buildOrderRow());

    const response = await createRequest("42");

    expect(response.status).toBe(200);
    expect(mocks.orderFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_displayId: { companyId: COMPANY_ID, displayId: 42 },
        },
        include: expect.objectContaining({
          events: expect.objectContaining({ orderBy: { createdAt: "asc" } }),
          emailMessages: expect.anything(),
          notifications: expect.anything(),
          items: expect.anything(),
          orderAttachments: expect.anything(),
          gsmTasks: expect.anything(),
        }),
      }),
    );

    const body = await response.json();

    expect(body.order).toMatchObject({
      orderNumber: 42,
      customerReference: "CUSTOMER-REF",
      status: "confirmed",
      rawStatus: "Bekreftet",
      statusNotes: "Called customer",
      customerComments: "Ring on arrival",
      driver: "Ola",
      secondDriver: "Kari",
      driverInfo: "Use back door",
      deviation: "Scratch on door",
      phone: "+4712345678",
      email: "customer@example.com",
      priceExVat: 1200,
      priceSubcontractor: 800,
      createdBy: { username: "Creator", email: "creator@example.com", role: "ADMIN" },
      lastEditedBy: null,
      createdAt: "2026-09-20T10:00:00.000Z",
    });
    expect(body.order.history).toEqual([
      expect.objectContaining({
        type: "STATUS_CHANGED",
        actorName: "Dispatcher",
        payload: { fromStatus: "pending", toStatus: "confirmed" },
      }),
    ]);
    expect(body.order.emailMessages).toEqual([
      expect.objectContaining({ subject: "Re: order 42", bodyText: "Thanks!" }),
    ]);
    expect(body.order.gsmTasks).toEqual([
      expect.objectContaining({ state: "completed", hasNotes: true }),
    ]);
    expect(body.order.attachments).toEqual([
      expect.objectContaining({ filename: "pod.pdf", category: "POD" }),
    ]);
  });

  it("never exposes bearer tokens, storage keys or the internal order id", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue(buildOrderRow());

    const response = await createRequest("42");
    const raw = await response.text();

    expect(raw).not.toContain("secret-action-token");
    expect(raw).not.toContain("secret-thread-token");
    expect(raw).not.toContain("orders/order-cuid/pod.pdf");

    const body = JSON.parse(raw);
    expect(body.order).not.toHaveProperty("id");
    expect(body.order).not.toHaveProperty("companyId");
    expect(body.order).not.toHaveProperty("displayId");
    expect(body.order).not.toHaveProperty("events");
    expect(body.order).not.toHaveProperty("orderAttachments");
  });

  it("returns 503 when the database lookup fails", async () => {
    mocks.orderFindUniqueMock.mockRejectedValue(new Error("database offline"));

    const response = await createRequest("42");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "SERVICE_UNAVAILABLE",
    });
  });
});
