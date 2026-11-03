import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  getOrderStripePaymentOverview: vi.fn(),
}));

vi.mock("@/lib/orders/websiteOrderAdminAccess", () => ({ authorizeWebsiteOrderAdmin: mocks.authorize }));
vi.mock("@/lib/orders/stripePaymentOverview", () => ({ getOrderStripePaymentOverview: mocks.getOrderStripePaymentOverview }));

import { GET } from "./route";

const params = { params: Promise.resolve({ orderId: "o1" }) };
const get = () => GET(new Request("http://localhost/api/orders/o1/payments"), params);

describe("GET /api/orders/[orderId]/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, companyId: "c1" });
    process.env.HOMEPAGE_PAYMENT_MODE = "stripe";
  });

  it("is admins only", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) });
    expect((await get()).status).toBe(403);
    expect(mocks.getOrderStripePaymentOverview).not.toHaveBeenCalled();
  });

  it("returns the order's Stripe payments and how it stands, with the payment mode", async () => {
    mocks.getOrderStripePaymentOverview.mockResolvedValue({ payments: [{ id: "p1" }], comparison: { outcome: "settled" } });

    const json = await (await get()).json();

    expect(json).toEqual({ ok: true, paymentMode: "stripe", payments: [{ id: "p1" }], comparison: { outcome: "settled" } });
    expect(mocks.getOrderStripePaymentOverview).toHaveBeenCalledWith("o1", "c1");
  });

  it("only says the mode while payments are manual (the fakturas are the payment history then)", async () => {
    process.env.HOMEPAGE_PAYMENT_MODE = "manual";
    expect(await (await get()).json()).toEqual({ ok: true, paymentMode: "manual" });
    expect(mocks.getOrderStripePaymentOverview).not.toHaveBeenCalled();
  });

  it("404s for an order of another company or none", async () => {
    mocks.getOrderStripePaymentOverview.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});
