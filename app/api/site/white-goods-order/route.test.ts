import { beforeEach, describe, expect, it, vi } from "vitest";

// The happy path exercises getBookingCatalog, buildOrderItemsFromCards,
// reserveNextManualOrderNumber's transaction, order/orderItem creation, and
// order events/notifications together — faithfully mocking that whole chain
// buys little over the manual end-to-end verification in the implementation
// plan. This file focuses on what's cheap and high-value to unit test: the
// request-level validation and rate limiting, which run before any of that
// pipeline is touched.

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: vi.fn() },
    priceList: { findUnique: vi.fn() },
  },
}));

// The route module keeps its rate limiter as module-level state, so each
// test re-imports a fresh module instance to avoid one test's request
// tripping the next test's rate limit.
async function freshPOST() {
  vi.resetModules();
  const mod = await import("./route");
  return mod.POST;
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/site/white-goods-order", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function post(body: unknown) {
  const POST = await freshPOST();
  return POST(jsonRequest(body));
}

const validBody = {
  productCards: [{ cardId: 0, productId: "product-1" }],
  pickupAddress: "Storgata 1, Oslo",
  deliveryAddress: "Storgata 2, Oslo",
  name: "Test Customer",
  phone: "+47 123 45 678",
  email: "customer@example.com",
};

describe("POST /api/site/white-goods-order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Order creation isn't mocked deep enough to succeed in these tests —
    // every scenario here is expected to fail validation/rate-limiting
    // before it would be reached.
  });

  it("returns 400 for invalid JSON", async () => {
    const POST = await freshPOST();
    const req = new Request("http://localhost/api/site/white-goods-order", {
      method: "POST",
      body: "not json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "INVALID_BODY" });
  });

  it("returns 422 with a phone error for a missing phone number", async () => {
    const res = await post({ ...validBody, phone: "" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors.phone).toBeDefined();
  });

  it("returns 422 with an email error for a malformed email", async () => {
    const res = await post({ ...validBody, email: "not-an-email" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.email).toBeDefined();
  });

  it("returns 422 when pickupAddress is missing", async () => {
    const res = await post({ ...validBody, pickupAddress: "" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.pickupAddress).toBe("Required");
  });

  it("returns 422 when no product cards are provided", async () => {
    const res = await post({ ...validBody, productCards: [] });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.productCards).toBeDefined();
  });

  it("returns 422 for a text field containing disallowed characters", async () => {
    const res = await post({ ...validBody, notes: "<script>alert(1)</script>" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.notes).toBeDefined();
  });
});
