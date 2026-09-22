import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrderByActionTokenMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  checkoutSessionsCreateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { order: { update: mocks.orderUpdateMock } },
}));

vi.mock("@/lib/orders/publicOrderAccess", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/publicOrderAccess")>(
    "@/lib/orders/publicOrderAccess",
  );
  return { ...actual, getOrderByActionToken: mocks.getOrderByActionTokenMock };
});

vi.mock("@/lib/stripe/stripeClient", () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: mocks.checkoutSessionsCreateMock } } }),
  getOrderActionBaseUrl: () => "https://otman.no",
}));

import { POST } from "./route";

function req() {
  return new Request("http://localhost/api/public/orders/abc/checkout", { method: "POST" });
}

function call(token = "a".repeat(32)) {
  return POST(req(), { params: Promise.resolve({ token }) });
}

const baseOrder = {
  id: "order1",
  displayId: 42,
  email: "customer@example.com",
  productsSummary: "White goods",
  priceExVat: 1000,
  rabatt: null,
  leggTil: null,
  pricingSnapshot: null,
  payments: [] as { amountChargedCents: number }[],
};

describe("POST /api/public/orders/[token]/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkoutSessionsCreateMock.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.com/cs_new" });
    mocks.orderUpdateMock.mockResolvedValue({});
  });

  it("returns 404 for an unknown token", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("charges the full order total for a normal (approved, never paid) order", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, status: "approved" });

    const res = await call();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe("https://checkout.stripe.com/cs_new");
    const createArgs = mocks.checkoutSessionsCreateMock.mock.calls[0][0];
    // 1000 ex VAT -> 1250 incl VAT -> 125000 øre.
    expect(createArgs.line_items[0].price_data.unit_amount).toBe(125000);
    expect(createArgs.metadata.chargeKind).toBe("initial");
  });

  it("rejects a confirmed order that has nothing left to pay", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({
      ...baseOrder,
      status: "confirmed",
      payments: [{ amountChargedCents: 125000 }],
    });

    const res = await call();
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "ORDER_NOT_PAYABLE" });
    expect(mocks.checkoutSessionsCreateMock).not.toHaveBeenCalled();
  });

  it("charges only the remaining balance for a confirmed order that's been added to since payment", async () => {
    // Original total was 1000 ex VAT (1250 incl VAT, 125000 øre), already
    // paid in full; staff then added items bringing priceExVat to 1400
    // (1750 incl VAT) — 500 kr / 50000 øre still owed.
    mocks.getOrderByActionTokenMock.mockResolvedValue({
      ...baseOrder,
      status: "confirmed",
      priceExVat: 1400,
      payments: [{ amountChargedCents: 125000 }],
    });

    const res = await call();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    const createArgs = mocks.checkoutSessionsCreateMock.mock.calls[0][0];
    expect(createArgs.line_items[0].price_data.unit_amount).toBe(50000);
    expect(createArgs.metadata.chargeKind).toBe("topup");
    expect(createArgs.metadata.orderId).toBe("order1");
  });

  it("still rejects a processing (not yet approved) order even with no payments", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, status: "processing" });

    const res = await call();
    expect(res.status).toBe(409);
  });

  it("requires a customer email", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, status: "approved", email: null });

    const res = await call();
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" });
  });
});
