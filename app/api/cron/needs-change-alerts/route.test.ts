import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runNeedsChangeNoReplySweep: vi.fn() }));

vi.mock("@/lib/orders/alerts/needsChangeNoReplySweep", () => ({
  runNeedsChangeNoReplySweep: mocks.runNeedsChangeNoReplySweep,
}));

import { POST } from "./route";

const url = "http://localhost/api/cron/needs-change-alerts";

describe("POST /api/cron/needs-change-alerts", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    mocks.runNeedsChangeNoReplySweep.mockResolvedValue({ scanned: 2, created: 1, skipped: 1, failed: 0 });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("is 401 without the cron secret, and doesn't run", async () => {
    expect((await POST(new Request(url, { method: "POST" }))).status).toBe(401);
    expect((await POST(new Request(url, { method: "POST", headers: { Authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(mocks.runNeedsChangeNoReplySweep).not.toHaveBeenCalled();
  });

  it("is 401 when CRON_SECRET isn't configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(new Request(url, { method: "POST", headers: { Authorization: "Bearer " } }))).status).toBe(401);
  });

  it("runs the sweep (with an optional limit) and returns its summary", async () => {
    const res = await POST(new Request(`${url}?limit=5`, { method: "POST", headers: { Authorization: "Bearer test-secret" } }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, scanned: 2, created: 1, skipped: 1, failed: 0 });
    expect(mocks.runNeedsChangeNoReplySweep).toHaveBeenCalledWith({ limit: 5 });
  });
});
