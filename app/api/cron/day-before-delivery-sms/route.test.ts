import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runDayBeforeDeliverySmsSweepMock: vi.fn() }));

vi.mock("@/lib/sms/dayBeforeDeliverySweep", () => ({ runDayBeforeDeliverySmsSweep: mocks.runDayBeforeDeliverySmsSweepMock }));

import { POST } from "./route";

describe("POST /api/cron/day-before-delivery-sms", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    mocks.runDayBeforeDeliverySmsSweepMock.mockResolvedValue({ date: "2026-10-26", scanned: 2, sent: 2, failed: 0, skipped: 0 });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 401 without the bearer secret", async () => {
    const res = await POST(new Request("http://localhost/api/cron/day-before-delivery-sms", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(mocks.runDayBeforeDeliverySmsSweepMock).not.toHaveBeenCalled();
  });

  it("runs the sweep and returns its summary", async () => {
    const res = await POST(
      new Request("http://localhost/api/cron/day-before-delivery-sms?limit=50", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, date: "2026-10-26", scanned: 2, sent: 2, failed: 0, skipped: 0 });
    expect(mocks.runDayBeforeDeliverySmsSweepMock).toHaveBeenCalledWith({ limit: 50 });
  });
});
