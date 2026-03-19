import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    selectActiveTenantForSessionMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/tenantSelect", () => ({
  selectActiveTenantForSession: mocks.selectActiveTenantForSessionMock,
}));

import { POST } from "./route";

describe("POST /api/auth/tenant/select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/tenant/select", {
      method: "POST",
      body: JSON.stringify({ companyId: "company-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });

    expect(mocks.selectActiveTenantForSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 and INVALID_COMPANY_ID when helper rejects blank company id", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    });

    mocks.selectActiveTenantForSessionMock.mockResolvedValue({
      ok: false,
      reason: "INVALID_COMPANY_ID",
    });

    const req = new Request("http://localhost/api/auth/tenant/select", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ companyId: "   " }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_COMPANY_ID",
    });

    expect(mocks.selectActiveTenantForSessionMock).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
      companyId: "   ",
    });
  });

  it("returns 403 and FORBIDDEN when helper rejects membership", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    });

    mocks.selectActiveTenantForSessionMock.mockResolvedValue({
      ok: false,
      reason: "FORBIDDEN",
    });

    const req = new Request("http://localhost/api/auth/tenant/select", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ companyId: "company-2" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });

  it("returns 404 and SESSION_NOT_FOUND when current session cannot be updated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    });

    mocks.selectActiveTenantForSessionMock.mockResolvedValue({
      ok: false,
      reason: "SESSION_NOT_FOUND",
    });

    const req = new Request("http://localhost/api/auth/tenant/select", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ companyId: "company-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "SESSION_NOT_FOUND",
    });
  });

  it("returns 200 and the selected activeTenant on success", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    });

    mocks.selectActiveTenantForSessionMock.mockResolvedValue({
      ok: true,
      companyId: "company-1",
      companyName: "Company One",
      companySlug: "company-one",
    });

    const req = new Request("http://localhost/api/auth/tenant/select", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ companyId: "company-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      activeTenant: {
        companyId: "company-1",
        companyName: "Company One",
        companySlug: "company-one",
      },
    });

    expect(mocks.selectActiveTenantForSessionMock).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
      companyId: "company-1",
    });
  });

  it("falls back to empty string companyId when json is malformed", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      email: "user@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    });

    mocks.selectActiveTenantForSessionMock.mockResolvedValue({
      ok: false,
      reason: "INVALID_COMPANY_ID",
    });

    const req = new Request("http://localhost/api/auth/tenant/select", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_COMPANY_ID",
    });

    expect(mocks.selectActiveTenantForSessionMock).toHaveBeenCalledWith({
      sessionId: "session-1",
      userId: "user-1",
      companyId: "",
    });
  });
});
