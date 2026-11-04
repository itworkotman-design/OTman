import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }));

vi.mock("@/lib/stripe/reconcileCheckoutSessions", () => ({ reconcileCheckoutSessions: mocks.reconcile }));
vi.mock("@/lib/stripe/stripeClient", () => ({ getStripeClient: () => ({ stripe: true }) }));

import { POST } from "./route";

const call = (secret = "s3cret") =>
  POST(new Request("http://localhost/api/cron/stripe-reconcile", { method: "POST", headers: { authorization: `Bearer ${secret}` } }));

describe("POST /api/cron/stripe-reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cret";
    process.env.HOMEPAGE_PAYMENT_MODE = "stripe";
    mocks.reconcile.mockResolvedValue({ checked: 2, recovered: 1, expired: 0, failed: 0 });
  });

  it("needs the cron secret", async () => {
    expect((await call("wrong")).status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("reconciles recent checkout sessions with Stripe and reports what it did", async () => {
    const res = await call();
    expect(await res.json()).toEqual({ ok: true, checked: 2, recovered: 1, expired: 0, failed: 0 });
    expect(mocks.reconcile).toHaveBeenCalledWith({ stripe: { stripe: true } });
  });

  it("does nothing while payments are manual (fakturas)", async () => {
    process.env.HOMEPAGE_PAYMENT_MODE = "manual";
    expect(await (await call()).json()).toEqual({ ok: true, skipped: "PAYMENTS_ARE_MANUAL" });
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});
