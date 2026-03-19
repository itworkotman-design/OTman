import { AuthEventType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    findFirstMock: vi.fn(),
    updateManyMock: vi.fn(),
    logAuthEventMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.findFirstMock,
    },
    session: {
      updateMany: mocks.updateManyMock,
    },
  },
}));

vi.mock("@/lib/auth/authEvent", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

import { selectActiveTenantForSession } from "./tenantSelect";

describe("selectActiveTenantForSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateManyMock.mockResolvedValue({ count: 1 });
    mocks.logAuthEventMock.mockResolvedValue(undefined);
  });

  it("returns INVALID_COMPANY_ID when companyId is blank", async () => {
    const result = await selectActiveTenantForSession({
      sessionId: "session-1",
      userId: "user-1",
      companyId: "   ",
    });

    expect(result).toEqual({
      ok: false,
      reason: "INVALID_COMPANY_ID",
    });

    expect(mocks.findFirstMock).not.toHaveBeenCalled();
    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when the user has no active membership in the company", async () => {
    mocks.findFirstMock.mockResolvedValue(null);

    const result = await selectActiveTenantForSession({
      sessionId: "session-1",
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });

    expect(mocks.findFirstMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        companyId: "company-1",
        status: "ACTIVE",
        company: {
          status: "ACTIVE",
        },
      },
      select: {
        companyId: true,
        company: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    expect(mocks.updateManyMock).not.toHaveBeenCalled();
    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("returns SESSION_NOT_FOUND when current session cannot be updated", async () => {
    mocks.findFirstMock.mockResolvedValue({
      companyId: "company-1",
      company: {
        name: "Company One",
        slug: "company-one",
      },
    });

    mocks.updateManyMock.mockResolvedValue({ count: 0 });

    const result = await selectActiveTenantForSession({
      sessionId: "session-1",
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).toEqual({
      ok: false,
      reason: "SESSION_NOT_FOUND",
    });

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      data: {
        activeCompanyId: "company-1",
      },
    });

    expect(mocks.logAuthEventMock).not.toHaveBeenCalled();
  });

  it("updates the current session and logs TENANT_SELECTED on success", async () => {
    mocks.findFirstMock.mockResolvedValue({
      companyId: "company-1",
      company: {
        name: "Company One",
        slug: "company-one",
      },
    });

    const result = await selectActiveTenantForSession({
      sessionId: "session-1",
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).toEqual({
      ok: true,
      companyId: "company-1",
      companyName: "Company One",
      companySlug: "company-one",
    });

    expect(mocks.updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      data: {
        activeCompanyId: "company-1",
      },
    });

    expect(mocks.logAuthEventMock).toHaveBeenCalledWith({
      type: AuthEventType.TENANT_SELECTED,
      userId: "user-1",
      companyId: "company-1",
      meta: {
        sessionId: "session-1",
      },
    });
  });
});

