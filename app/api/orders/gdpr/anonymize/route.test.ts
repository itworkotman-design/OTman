import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  runGdprCleanupMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
  },
}));

vi.mock("@/lib/gdpr/runGdprCleanup", () => ({
  runGdprCleanup: mocks.runGdprCleanupMock,
  // Real (tiny, pure) implementation rather than importOriginal — the real
  // module also pulls in @/lib/db, which this test file has no reason to
  // mock otherwise.
  parseGdprLimitParam: (searchParams: URLSearchParams) => {
    const raw = searchParams.get("limit");
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
  },
}));

import { POST } from "./route";

function req() {
  return new Request("http://localhost/api/orders/gdpr/anonymize", { method: "POST" });
}

describe("POST /api/orders/gdpr/anonymize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runGdprCleanupMock.mockResolvedValue({ anonymized: 1, podCleaned: 0, failed: 0 });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await POST(req());

    expect(res.status).toBe(401);
    expect(mocks.runGdprCleanupMock).not.toHaveBeenCalled();
  });

  it("returns 409 when no active company is selected", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "user-1", activeCompanyId: null });

    const res = await POST(req());

    expect(res.status).toBe(409);
  });

  it("returns 403 for a non-admin membership", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER" });

    const res = await POST(req());

    expect(res.status).toBe(403);
    expect(mocks.runGdprCleanupMock).not.toHaveBeenCalled();
  });

  it("runs the cleanup scoped to the active company for an OWNER/ADMIN and returns its summary", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN" });

    const res = await POST(req());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      anonymized: 1,
      podCleaned: 0,
      failed: 0,
    });
    expect(mocks.runGdprCleanupMock).toHaveBeenCalledWith({
      companyId: "company-1",
      limit: undefined,
    });
  });

  it("passes a numeric ?limit= query param through to runGdprCleanup", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN" });

    await POST(new Request("http://localhost/api/orders/gdpr/anonymize?limit=50", { method: "POST" }));

    expect(mocks.runGdprCleanupMock).toHaveBeenCalledWith({
      companyId: "company-1",
      limit: 50,
    });
  });
});
