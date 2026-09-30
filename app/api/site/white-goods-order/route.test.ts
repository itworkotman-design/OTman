import { beforeEach, describe, expect, it, vi } from "vitest";

// The happy path exercises getBookingCatalog, buildOrderItemsFromCards,
// reserveNextManualOrderNumber's transaction, order/orderItem creation, and
// order events/notifications together — faithfully mocking that whole chain
// buys little over the manual end-to-end verification in the implementation
// plan. This file focuses on what's cheap and high-value to unit test: the
// request-level validation and rate limiting, which run before any of that
// pipeline is touched.

vi.mock("@/lib/orders/sendOrderReceivedEmail", () => ({ sendOrderReceivedEmail: vi.fn() }));

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
  pickupSource: "store",
  pickupPlaceName: "Elkjøp Lillestrøm",
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

  it("returns 422 when the email is missing — the customer's confirmation and payment link go there, so it is mandatory", async () => {
    for (const email of ["", "   ", undefined]) {
      const res = await post({ ...validBody, email });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.errors.email).toBe("Required");
    }
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

  it("returns 422 when pickupSource is missing or unrecognized", async () => {
    for (const pickupSource of [undefined, "", "supplier"]) {
      const res = await post({ ...validBody, pickupSource });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.errors.pickupSource).toBe("Required");
    }
  });

  it("requires a place name for a store pickup", async () => {
    const res = await post({ ...validBody, pickupSource: "store", pickupPlaceName: "" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.pickupPlaceName).toBe("Required");
    expect(json.errors.pickupContactName).toBeUndefined();
    expect(json.errors.pickupContactPhone).toBeUndefined();
  });

  it("requires a contact name and phone, but no place name, for a private-individual pickup", async () => {
    const res = await post({
      ...validBody,
      pickupSource: "private",
      pickupPlaceName: "",
      pickupContactName: "",
      pickupContactPhone: "",
    });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.pickupPlaceName).toBeUndefined();
    expect(json.errors.pickupContactName).toBe("Required");
    expect(json.errors.pickupContactPhone).toBe("Required");
  });

  it("requires a place name, a contact name, and a phone for a business pickup", async () => {
    const res = await post({
      ...validBody,
      pickupSource: "business",
      pickupPlaceName: "",
      pickupContactName: "",
      pickupContactPhone: "",
    });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.pickupPlaceName).toBe("Required");
    expect(json.errors.pickupContactName).toBe("Required");
    expect(json.errors.pickupContactPhone).toBe("Required");
  });

  it("raises no pickup-contact errors for a fully filled-in business pickup", async () => {
    // Paired with a deliberately invalid email so the request still fails
    // validation (every other test in this file relies on that — order
    // creation itself isn't mocked deep enough to succeed here) without
    // this one reaching past the validation layer.
    const res = await post({
      ...validBody,
      email: "not-an-email",
      pickupSource: "business",
      pickupPlaceName: "Acme AS",
      pickupContactName: "Kari Nordmann",
      pickupContactPhone: "+47 987 65 432",
    });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.email).toBeDefined();
    expect(json.errors.pickupPlaceName).toBeUndefined();
    expect(json.errors.pickupContactName).toBeUndefined();
    expect(json.errors.pickupContactPhone).toBeUndefined();
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
