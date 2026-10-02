import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runMissingPartnerAlertSweepMock: vi.fn(),
}));

vi.mock("@/lib/orders/alerts/missingPartnerSweep", () => ({
  runMissingPartnerAlertSweep: mocks.runMissingPartnerAlertSweepMock,
  // Real (tiny, pure) implementation rather than importOriginal — the real
  // module also pulls in @/lib/db, which this test file has no reason to
  // mock otherwise.
  parseMissingPartnerLimitParam: (searchParams: URLSearchParams) => {
    const raw = searchParams.get("limit");
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
  },
}));

import { POST } from "./route";

describe("POST /api/cron/missing-partner-alerts", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    mocks.runMissingPartnerAlertSweepMock.mockResolvedValue({ scanned: 3, created: 2, skipped: 1, failed: 0 });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 401 when no Authorization header is provided", async () => {
    const req = new Request("http://localhost/api/cron/missing-partner-alerts", { method: "POST" });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mocks.runMissingPartnerAlertSweepMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer secret does not match", async () => {
    const req = new Request("http://localhost/api/cron/missing-partner-alerts", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mocks.runMissingPartnerAlertSweepMock).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is not configured on the server", async () => {
    delete process.env.CRON_SECRET;

    const req = new Request("http://localhost/api/cron/missing-partner-alerts", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("runs the sweep and returns its summary when the secret matches", async () => {
    const req = new Request("http://localhost/api/cron/missing-partner-alerts", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      scanned: 3,
      created: 2,
      skipped: 1,
      failed: 0,
    });
    expect(mocks.runMissingPartnerAlertSweepMock).toHaveBeenCalledWith({ limit: undefined });
  });

  it("passes a numeric ?limit= query param through to the sweep", async () => {
    const req = new Request("http://localhost/api/cron/missing-partner-alerts?limit=200", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });

    await POST(req);

    expect(mocks.runMissingPartnerAlertSweepMock).toHaveBeenCalledWith({ limit: 200 });
  });

  it("ignores an invalid ?limit= value", async () => {
    const req = new Request("http://localhost/api/cron/missing-partner-alerts?limit=not-a-number", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });

    await POST(req);

    expect(mocks.runMissingPartnerAlertSweepMock).toHaveBeenCalledWith({ limit: undefined });
  });
});
