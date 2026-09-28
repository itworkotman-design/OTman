import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cleanupMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/orders/orderAttachmentStorage", () => ({ deleteAttachmentFile: vi.fn() }));
vi.mock("@/lib/orders/pendingQuoteAttachments", () => ({
  cleanupExpiredPendingQuoteAttachments: mocks.cleanupMock,
}));

import { POST } from "./route";

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/quote-photo-cleanup", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("POST /api/cron/quote-photo-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cret";
    mocks.cleanupMock.mockResolvedValue({ scanned: 2, filesDeleted: 2, rowsDeleted: 2 });
  });

  it("rejects a missing or wrong bearer secret without touching anything", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("Bearer nope"))).status).toBe(401);
    expect(mocks.cleanupMock).not.toHaveBeenCalled();
  });

  it("sweeps rows older than a day and returns the summary", async () => {
    const res = await POST(request("Bearer s3cret"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, scanned: 2, filesDeleted: 2, rowsDeleted: 2 });
    expect(mocks.cleanupMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxAgeMs: 24 * 60 * 60 * 1000 }),
    );
  });
});
