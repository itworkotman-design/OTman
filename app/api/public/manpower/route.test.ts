import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
  incrementRateLimitMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
  orderCreateMock: vi.fn(),
  createOrderCreatedEventMock: vi.fn(),
  createOrderNotificationMock: vi.fn(),
  reserveNextManualOrderNumberMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: mocks.membershipFindUniqueMock },
    order: { create: mocks.orderCreateMock },
  },
}));

vi.mock("@/lib/auth/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimitMock,
  incrementRateLimit: mocks.incrementRateLimitMock,
}));

vi.mock("@/lib/orders/orderNumber", () => ({
  reserveNextManualOrderNumber: mocks.reserveNextManualOrderNumberMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderCreatedEvent: mocks.createOrderCreatedEventMock,
  buildOrderEventSnapshot: (snapshot: unknown) => snapshot,
}));

vi.mock("@/lib/orders/orderNotifications", () => ({
  createOrderNotification: mocks.createOrderNotificationMock,
}));

async function freshPOST() {
  vi.resetModules();
  const mod = await import("./route");
  return mod.POST;
}

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/public/manpower", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

async function post(body: unknown, headers?: Record<string, string>) {
  const POST = await freshPOST();
  return POST(jsonRequest(body, headers));
}

const validBody = {
  name: "Ola Nordmann",
  contact: "ola@example.com",
  jobType: "option-1", // Electrician, per TjenesterContent's real live options
  customService: "",
  // No punctuation — the route's own LETTERS_NUMBERS_RE only allows
  // letters/numbers/whitespace in the description field.
  description: "Need an electrician to install a new outlet in the kitchen",
};

describe("POST /api/public/manpower", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimitMock.mockResolvedValue({ allowed: true });
    mocks.incrementRateLimitMock.mockResolvedValue(undefined);
  });

  it("returns a fake success without doing anything when the honeypot field is filled", async () => {
    const res = await post({ ...validBody, _hp: "im-a-bot" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("still rejects an invalid name the same way as before", async () => {
    const res = await post({ ...validBody, name: "x" });
    expect(res.status).toBe(400);
  });

  it("still rejects a missing/too-short contact the same way as before", async () => {
    const res = await post({ ...validBody, contact: "a" });
    expect(res.status).toBe(400);
  });

  it("still rejects a missing job type", async () => {
    const res = await post({ ...validBody, jobType: "" });
    expect(res.status).toBe(400);
  });

  it("still rejects custom job type with no custom service text", async () => {
    const res = await post({ ...validBody, jobType: "custom", customService: "" });
    expect(res.status).toBe(400);
  });

  it("still rejects a too-short description", async () => {
    const res = await post({ ...validBody, description: "short" });
    expect(res.status).toBe(400);
  });

  it("still returns RATE_LIMIT_MINUTE on a second request within a minute, same reason string the live form checks for", async () => {
    const POST = await freshPOST();
    await POST(jsonRequest(validBody));
    const res = await POST(jsonRequest(validBody));
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "RATE_LIMIT_MINUTE" });
  });

  it("returns 500 when order creation fails (e.g. WEBSITE_MEMBERSHIP_ID not configured in this test env) rather than silently succeeding", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(500);
  });

  describe("with WEBSITE_MEMBERSHIP_ID configured", () => {
    beforeEach(() => {
      process.env.WEBSITE_MEMBERSHIP_ID = "membership1";
      mocks.membershipFindUniqueMock.mockResolvedValue({ id: "membership1", companyId: "company1", status: "ACTIVE" });
      mocks.reserveNextManualOrderNumberMock.mockResolvedValue(101);
      mocks.orderCreateMock.mockResolvedValue({
        id: "order1",
        companyId: "company1",
        displayId: 101,
        status: "processing",
      });
      mocks.createOrderCreatedEventMock.mockResolvedValue(undefined);
      mocks.createOrderNotificationMock.mockResolvedValue(undefined);
    });

    it("creates an unpriced Order (not a direct email) — lands in the same dashboard/approve/quote/pay pipeline as every other website order", async () => {
      const res = await post(validBody);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ ok: true, orderId: "order1", displayId: 101 });

      const createArgs = mocks.orderCreateMock.mock.calls[0][0].data;
      expect(createArgs.isWebsiteOrder).toBe(true);
      expect(createArgs.status).toBe("processing");
      expect(createArgs.priceExVat).toBe(0);
      expect(createArgs.customerName).toBe("Ola Nordmann");
      // contact "ola@example.com" looks like an email -> classified as email.
      expect(createArgs.email).toBe("ola@example.com");
      expect(createArgs.phone).toBeNull();
      expect(createArgs.description).toContain("Electrician");
      expect(createArgs.description).toContain("ola@example.com");

      expect(mocks.createOrderNotificationMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ orderId: "order1", type: "MANUAL_REVIEW" }),
      );
    });

    it("classifies a phone-shaped contact as phone, not email", async () => {
      await post({ ...validBody, contact: "+47 987 65 432" });

      const createArgs = mocks.orderCreateMock.mock.calls[0][0].data;
      expect(createArgs.phone).toBe("+47 987 65 432");
      expect(createArgs.email).toBeNull();
    });

    it("includes the custom service text in the description for a custom job type", async () => {
      await post({ ...validBody, jobType: "custom", customService: "Bee removal" });

      const createArgs = mocks.orderCreateMock.mock.calls[0][0].data;
      expect(createArgs.description).toContain("Bee removal");
    });
  });
});
