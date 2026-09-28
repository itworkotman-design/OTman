import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  linkPendingQuoteAttachmentsMock: vi.fn(),
  promotePendingQuoteAttachmentsMock: vi.fn(),
  membershipFindUnique: vi.fn(),
  orderCreate: vi.fn(),
  reserveNextManualOrderNumberMock: vi.fn(),
  sendOrderReceivedEmailMock: vi.fn(),
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

vi.mock("@/lib/orders/sendOrderReceivedEmail", () => ({
  sendOrderReceivedEmail: mocks.sendOrderReceivedEmailMock,
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

vi.mock("@/lib/orders/pendingQuoteAttachments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/pendingQuoteAttachments")>(
    "@/lib/orders/pendingQuoteAttachments",
  );
  return {
    ...actual,
    linkPendingQuoteAttachments: mocks.linkPendingQuoteAttachmentsMock,
    promotePendingQuoteAttachments: mocks.promotePendingQuoteAttachmentsMock,
  };
});

async function freshPOST() {
  vi.resetModules();
  const mod = await import("./route");
  return mod.POST;
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/site/special-goods-quote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function post(body: unknown) {
  const POST = await freshPOST();
  return POST(jsonRequest(body));
}

const VALID_TOKEN = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

const validBody = {
  name: "Test Customer",
  phone: "+47 123 45 678",
  email: "customer@example.com",
  description: "An oversized grandfather clock that needs careful handling.",
  pickupAddress: "Storgata 1, Oslo",
  deliveryAddress: "Storgata 2, Oslo",
  preferredDate: "2026-10-01",
  timeWindow: "08:00-16:00",
  notes: "",
  quoteToken: VALID_TOKEN,
};

describe("POST /api/site/special-goods-quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a fake success without doing anything when the honeypot field is filled", async () => {
    const res = await post({ ...validBody, _hp: "im-a-bot" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mocks.linkPendingQuoteAttachmentsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const POST = await freshPOST();
    const req = new Request("http://localhost/api/site/special-goods-quote", { method: "POST", body: "not json" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 422 when description is missing", async () => {
    const res = await post({ ...validBody, description: "" });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.description).toBe("Required");
  });

  it("returns 422 with a phone error for a missing phone", async () => {
    const res = await post({ ...validBody, phone: "" });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.phone).toBeDefined();
  });

  it("returns 422 with an email error for a missing email", async () => {
    const res = await post({ ...validBody, email: "" });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.email).toBe("Required");
  });

  it("returns 422 when pickupAddress is missing", async () => {
    const res = await post({ ...validBody, pickupAddress: "" });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.pickupAddress).toBe("Required");
  });

  it("returns 422 for a text field containing disallowed characters", async () => {
    const res = await post({ ...validBody, notes: "<script>alert(1)</script>" });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.notes).toBeDefined();
  });

  it("still accepts a submission with no quoteToken/photos (photos are optional)", async () => {
    const res = await post({ ...validBody, quoteToken: "" });
    // Fails downstream (no WEBSITE_MEMBERSHIP_ID configured in this test env)
    // but must NOT fail validation for a missing/empty quoteToken.
    const json = await res.json().catch(() => null);
    expect(json?.reason).not.toBe("VALIDATION_FAILED");
  });

  it("returns 429 on a second request within a minute", async () => {
    const POST = await freshPOST();
    await POST(jsonRequest(validBody));
    const res = await POST(jsonRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("sends the customer an order-received email once the order (and its photos) are saved", async () => {
    process.env.WEBSITE_MEMBERSHIP_ID = "m1";
    mocks.membershipFindUnique.mockResolvedValue({ id: "m1", companyId: "c1", status: "ACTIVE" });
    mocks.reserveNextManualOrderNumberMock.mockResolvedValue(7);
    mocks.reservePublicOrderNumberMock.mockResolvedValue("K7MQ4XZ2");
    mocks.promotePendingQuoteAttachmentsMock.mockResolvedValue(1);
    mocks.linkPendingQuoteAttachmentsMock.mockResolvedValue(1);
    mocks.orderCreate.mockResolvedValue({ id: "order1", companyId: "c1", displayId: 7, orderNumber: "K7MQ4XZ2", status: "processing", email: "customer@example.com" });

    const res = await post(validBody);
    delete process.env.WEBSITE_MEMBERSHIP_ID;

    expect(res.status).toBe(200);
    // Customers see the random public number, not the sequential displayId.
    await expect(res.json()).resolves.toMatchObject({ ok: true, orderNumber: "K7MQ4XZ2" });
    expect(mocks.orderCreate.mock.calls[0][0].data).toMatchObject({ displayId: 7, orderNumber: "K7MQ4XZ2" });
    expect(mocks.sendOrderReceivedEmailMock).toHaveBeenCalledWith(expect.objectContaining({ id: "order1", email: "customer@example.com" }));
  });

  it("promotes the photos out of tmp/ BEFORE creating the order, and creates no order if that fails", async () => {
    process.env.WEBSITE_MEMBERSHIP_ID = "m1";
    mocks.membershipFindUnique.mockResolvedValue({ id: "m1", companyId: "c1", status: "ACTIVE" });
    mocks.reserveNextManualOrderNumberMock.mockResolvedValue(1);
    mocks.promotePendingQuoteAttachmentsMock.mockRejectedValue(new Error("copy failed"));

    const res = await post(validBody);
    delete process.env.WEBSITE_MEMBERSHIP_ID;

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false, reason: "ORDER_CREATION_FAILED" });
    expect(mocks.promotePendingQuoteAttachmentsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ quoteToken: VALID_TOKEN }),
    );
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });
});
