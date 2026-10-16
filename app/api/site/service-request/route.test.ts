import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  orderCreate: vi.fn(),
  reserveNextManualOrderNumberMock: vi.fn(),
  welcomeWebsiteOrderCustomerMock: vi.fn(),
  reservePublicOrderNumberMock: vi.fn(),
  createOrderCreatedEventMock: vi.fn(),
  createOrderNotificationMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: mocks.membershipFindUnique },
    order: { create: mocks.orderCreate },
  },
}));

vi.mock("@/lib/customerAccounts/welcomeWebsiteOrderCustomer", () => ({
  welcomeWebsiteOrderCustomer: mocks.welcomeWebsiteOrderCustomerMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderCreatedEvent: mocks.createOrderCreatedEventMock,
  buildOrderEventSnapshot: (snapshot: unknown) => snapshot,
}));

vi.mock("@/lib/orders/orderNotifications", () => ({
  createOrderNotification: mocks.createOrderNotificationMock,
}));

vi.mock("@/lib/orders/publicOrderNumber", () => ({
  reservePublicOrderNumber: mocks.reservePublicOrderNumberMock,
}));

vi.mock("@/lib/orders/orderNumber", () => ({
  reserveNextManualOrderNumber: mocks.reserveNextManualOrderNumberMock,
}));

async function freshPOST() {
  vi.resetModules();
  const mod = await import("./route");
  return mod.POST;
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/site/service-request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function post(body: unknown) {
  const POST = await freshPOST();
  return POST(jsonRequest(body));
}

const validBody = {
  customerType: "private",
  services: [{ serviceCode: "option-1", customService: "", jobDescription: "Install three ceiling lights in the living room." }],
  address: "Storgata 1, Oslo",
  preferredDate: "2026-10-20",
  timeWindow: "08:00-16:00",
  name: "Kari Nordmann",
  phone: "+4712345678",
  email: "kari@example.com",
  notes: "",
};

function mockOrderCreation() {
  process.env.WEBSITE_MEMBERSHIP_ID = "m1";
  mocks.membershipFindUnique.mockResolvedValue({ id: "m1", companyId: "c1", status: "ACTIVE" });
  mocks.reserveNextManualOrderNumberMock.mockResolvedValue(7);
  mocks.reservePublicOrderNumberMock.mockResolvedValue("K7MQ4XZ2");
  mocks.orderCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "order1", ...data }));
}

describe("POST /api/site/service-request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEBSITE_MEMBERSHIP_ID;
  });

  it("returns a fake success without doing anything when the honeypot field is filled", async () => {
    const res = await post({ ...validBody, _hp: "bot" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const POST = await freshPOST();
    const res = await POST(new Request("http://localhost/api/site/service-request", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
  });

  it.each([
    ["services", { services: [] }, "Required"],
    ["services.0.serviceCode", { services: [{ serviceCode: "option-99", customService: "", jobDescription: "x" }] }, "Unknown service"],
    ["services.0.customService", { services: [{ serviceCode: "custom", customService: "", jobDescription: "x" }] }, "Required"],
    ["services.0.jobDescription", { services: [{ serviceCode: "option-1", customService: "", jobDescription: "" }] }, "Required"],
    ["address", { address: "" }, "Required"],
    ["name", { name: "" }, "Required"],
    ["email", { email: "" }, "Required"],
    ["phone", { phone: "" }, "Required"],
    ["notes", { notes: "<script>" }, "Contains disallowed characters"],
  ])("returns 422 with a %s error", async (field, patch, message) => {
    const res = await post({ ...validBody, ...patch });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.reason).toBe("VALIDATION_FAILED");
    expect(json.errors[field]).toBe(message);
  });

  it("returns 429 on a second request within a minute", async () => {
    const POST = await freshPOST();
    await POST(jsonRequest(validBody));
    const res = await POST(jsonRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("creates an unpriced website order for staff to quote, and welcomes the customer", async () => {
    mockOrderCreation();

    const res = await post({ ...validBody, customerType: "business" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, orderNumber: "K7MQ4XZ2", displayId: 7 });
    const data = mocks.orderCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      displayId: 7,
      orderNumber: "K7MQ4XZ2",
      status: "processing",
      isWebsiteOrder: true,
      deliveryAddress: "Storgata 1, Oslo",
      customerName: "Kari Nordmann",
      phone: "+4712345678",
      email: "kari@example.com",
      deliveryDate: "2026-10-20",
      timeWindow: "08:00-16:00",
      productsSummary: "Service request (Electrician)",
      priceExVat: 0,
      priceSubcontractor: 0,
      // Opens in the admin WebsiteOrderModal, with the answers as cards.
      websiteOrderKind: "SERVICE",
      websiteBookingDetails: {
        version: 2,
        customerType: "business",
        services: [{ serviceCode: "option-1", customService: "", jobDescription: "Install three ceiling lights in the living room." }],
      },
    });
    expect(data.description).toContain("Service: Electrician");
    expect(data.description).toContain("Customer type: Business");
    expect(data.description).toContain("Install three ceiling lights in the living room.");
    expect(mocks.createOrderNotificationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "MANUAL_REVIEW", title: "WEBSITE ORDER - Service request (Electrician)" }),
    );
    expect(mocks.welcomeWebsiteOrderCustomerMock).toHaveBeenCalledWith(expect.objectContaining({ id: "order1" }));
  });

  it("takes several services, each with its own job, and labels a custom one by what the customer typed", async () => {
    mockOrderCreation();

    const res = await post({
      ...validBody,
      services: [
        { serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
        { serviceCode: "custom", customService: "Painter", jobDescription: "Paint the hall." },
      ],
    });

    expect(res.status).toBe(200);
    const data = mocks.orderCreate.mock.calls[0][0].data;
    expect(data.productsSummary).toBe("Service request (Electrician + Custom service — Painter)");
    expect(data.description).toBe("Customer type: Private\n\nService: Electrician\nInstall lights.\n\nService: Custom service — Painter\nPaint the hall.");
    expect(data.websiteBookingDetails.services).toEqual([
      { serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
      { serviceCode: "custom", customService: "Painter", jobDescription: "Paint the hall." },
    ]);
  });

  it("keeps the customer's comment on its own", async () => {
    mockOrderCreation();
    await post({ ...validBody, notes: "Ring the bell twice" });
    const data = mocks.orderCreate.mock.calls[0][0].data;
    expect(data.customerComments).toBe("Ring the bell twice");
    expect(data.description).not.toContain("Ring the bell twice");
  });

  it("returns 500 when the website membership isn't configured", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false, reason: "ORDER_CREATION_FAILED" });
  });
});
