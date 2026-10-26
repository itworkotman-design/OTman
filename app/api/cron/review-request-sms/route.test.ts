import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runReviewRequestSmsSweepMock: vi.fn() }));

vi.mock("@/lib/sms/reviewRequestSweep", () => ({ runReviewRequestSmsSweep: mocks.runReviewRequestSmsSweepMock }));

import { POST } from "./route";

describe("POST /api/cron/review-request-sms", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    mocks.runReviewRequestSmsSweepMock.mockResolvedValue({ scanned: 1, sent: 1, failed: 0, skipped: 0 });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 401 without the bearer secret", async () => {
    const res = await POST(new Request("http://localhost/api/cron/review-request-sms", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(mocks.runReviewRequestSmsSweepMock).not.toHaveBeenCalled();
  });

  it("runs the sweep and returns its summary", async () => {
    const res = await POST(
      new Request("http://localhost/api/cron/review-request-sms?limit=25", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, scanned: 1, sent: 1, failed: 0, skipped: 0 });
    expect(mocks.runReviewRequestSmsSweepMock).toHaveBeenCalledWith({ limit: 25 });
  });
});
