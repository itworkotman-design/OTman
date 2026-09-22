import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors white-goods-order/route.test.ts's approach: this file focuses on
// what's cheap and high-value to unit test — request-level validation, rate
// limiting, and price resolution — rather than deep-mocking the whole order
// creation chain.

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: vi.fn() },
  },
}));

const mocks = vi.hoisted(() => ({
  getMovingCatalogMock: vi.fn(),
}));

vi.mock("@/lib/content/getMovingCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content/getMovingCatalog")>(
    "@/lib/content/getMovingCatalog",
  );
  return { ...actual, getMovingCatalog: mocks.getMovingCatalogMock };
});

// The route module keeps its rate limiter as module-level state, so each
// test re-imports a fresh module instance to avoid one test's request
// tripping the next test's rate limit.
async function freshPOST() {
  vi.resetModules();
  const mod = await import("./route");
  return mod.POST;
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/site/moving-request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function post(body: unknown) {
  const POST = await freshPOST();
  return POST(jsonRequest(body));
}

const validBody = {
  name: "Test Customer",
  phone: "+47 123 45 678",
  email: "customer@example.com",
  pickupAddress: "Storgata 1, Oslo",
  deliveryAddress: "Storgata 2, Oslo",
  preferredDate: "2026-10-01",
  timeWindow: "08:00-16:00",
  sizeOptionCode: "SIZE_UNDER_40",
  notes: "Third floor, no lift on either end.",
};

describe("POST /api/site/moving-request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMovingCatalogMock.mockResolvedValue({
      priceListId: "pl-moving",
      options: [
        { code: "SIZE_UNDER_20", labelEn: "Under 20 m²", labelNo: "Under 20 m²", customerPriceCents: 800000, subcontractorPriceCents: 500000 },
        { code: "SIZE_UNDER_40", labelEn: "Under 40 m²", labelNo: "Under 40 m²", customerPriceCents: 1400000, subcontractorPriceCents: 900000 },
      ],
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const POST = await freshPOST();
    const req = new Request("http://localhost/api/site/moving-request", {
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
    expect(json.errors.phone).toBeDefined();
  });

  it("returns 422 with an email error for a missing email", async () => {
    const res = await post({ ...validBody, email: "" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.email).toBe("Required");
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

  it("returns 422 when deliveryAddress is missing", async () => {
    const res = await post({ ...validBody, deliveryAddress: "" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.deliveryAddress).toBe("Required");
  });

  it("returns 422 when name is missing", async () => {
    const res = await post({ ...validBody, name: "" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.name).toBe("Required");
  });

  it("returns 422 when sizeOptionCode is missing", async () => {
    const res = await post({ ...validBody, sizeOptionCode: "" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.sizeOptionCode).toBe("Required");
  });

  it("returns 422 when sizeOptionCode doesn't match a real size bracket", async () => {
    const res = await post({ ...validBody, sizeOptionCode: "NOT_A_REAL_CODE" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.sizeOptionCode).toBeDefined();
  });

  it("returns 500 when the moving catalog hasn't been seeded yet", async () => {
    mocks.getMovingCatalogMock.mockResolvedValue(null);

    const res = await post(validBody);

    expect(res.status).toBe(500);
  });

  it("returns 422 for a text field containing disallowed characters", async () => {
    const res = await post({ ...validBody, notes: "<script>alert(1)</script>" });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.errors.notes).toBeDefined();
  });

  it("returns 429 on a second request within a minute", async () => {
    const POST = await freshPOST();
    await POST(jsonRequest(validBody));
    const res = await POST(jsonRequest(validBody));

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "RATE_LIMIT_MINUTE" });
  });
});
