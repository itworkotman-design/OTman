import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runGdprCleanupMock: vi.fn(),
}));

vi.mock("@/lib/gdpr/runGdprCleanup", () => ({
  runGdprCleanup: mocks.runGdprCleanupMock,
}));

import { POST } from "./route";

describe("POST /api/cron/gdpr-cleanup", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    mocks.runGdprCleanupMock.mockResolvedValue({ anonymized: 2, podCleaned: 1, failed: 0 });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 401 when no Authorization header is provided", async () => {
    const req = new Request("http://localhost/api/cron/gdpr-cleanup", { method: "POST" });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mocks.runGdprCleanupMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer secret does not match", async () => {
    const req = new Request("http://localhost/api/cron/gdpr-cleanup", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mocks.runGdprCleanupMock).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is not configured on the server", async () => {
    delete process.env.CRON_SECRET;

    const req = new Request("http://localhost/api/cron/gdpr-cleanup", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("runs the cleanup and returns its summary when the secret matches", async () => {
    const req = new Request("http://localhost/api/cron/gdpr-cleanup", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      anonymized: 2,
      podCleaned: 1,
      failed: 0,
    });
    expect(mocks.runGdprCleanupMock).toHaveBeenCalledWith();
  });
});
