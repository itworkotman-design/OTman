import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  requestOrderBalancePayment: vi.fn(),
}));

vi.mock("@/lib/orders/websiteOrderAdminAccess", () => ({ authorizeWebsiteOrderAdmin: mocks.authorize }));
vi.mock("@/lib/orders/requestOrderBalancePayment", () => ({ requestOrderBalancePayment: mocks.requestOrderBalancePayment }));

import { POST } from "./route";

const params = { params: Promise.resolve({ orderId: "o1" }) };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/orders/o1/request-payment", { method: "POST", body: JSON.stringify(body) }), params);

describe("POST /api/orders/[orderId]/request-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, companyId: "c1", actor: { source: "USER" } });
    process.env.HOMEPAGE_PAYMENT_MODE = "stripe";
  });

  it("is admins only", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) });
    expect((await post({ amountCents: 25000 })).status).toBe(403);
    expect(mocks.requestOrderBalancePayment).not.toHaveBeenCalled();
  });

  it("sends the payment request for the amount staff saw", async () => {
    mocks.requestOrderBalancePayment.mockResolvedValue({ ok: true, amountCents: 25000 });

    const res = await post({ amountCents: 25000 });

    expect(await res.json()).toEqual({ ok: true, amountCents: 25000 });
    expect(mocks.requestOrderBalancePayment).toHaveBeenCalledWith({
      orderId: "o1",
      companyId: "c1",
      actor: { source: "USER" },
      expectedAmountCents: 25000,
    });
  });

  it("passes refusals through with their status", async () => {
    mocks.requestOrderBalancePayment.mockResolvedValue({ ok: false, reason: "AMOUNT_CHANGED", status: 409, amountCents: 30000 });
    const res = await post({ amountCents: 25000 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "AMOUNT_CHANGED", amountCents: 30000 });
  });

  it("is off while payments are manual (fakturas)", async () => {
    process.env.HOMEPAGE_PAYMENT_MODE = "manual";
    const res = await post({ amountCents: 25000 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "PAYMENTS_ARE_MANUAL" });
    expect(mocks.requestOrderBalancePayment).not.toHaveBeenCalled();
  });
});
