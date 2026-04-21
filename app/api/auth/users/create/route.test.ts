import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    createUserWithPasswordMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/userCreate", () => ({
  createUserWithPassword: mocks.createUserWithPasswordMock,
}));

import { POST } from "./route";

describe("POST /api/auth/users/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "actor-1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: "company-active",
      activeCompanyName: "Active Company",
      activeCompanySlug: "active-company",
    });

    mocks.createUserWithPasswordMock.mockResolvedValue({ ok: true });
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/auth/users/create", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        role: "USER",
        password: "password123",
        confirmPassword: "password123",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("returns 409 and TENANT_SELECTION_REQUIRED when session has no active tenant", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValueOnce({
      sessionId: "session-1",
      userId: "actor-1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySlug: null,
    });

    const req = new Request("http://localhost/api/auth/users/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
        role: "USER",
        password: "password123",
        confirmPassword: "password123",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "TENANT_SELECTION_REQUIRED",
    });
  });

  it("returns 400 and PASSWORD_MISMATCH when passwords differ", async () => {
    const req = new Request("http://localhost/api/auth/users/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
        role: "USER",
        password: "password123",
        confirmPassword: "password456",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "PASSWORD_MISMATCH",
    });

    expect(mocks.createUserWithPasswordMock).not.toHaveBeenCalled();
  });

  it("returns 201 and ok true on success", async () => {
    const req = new Request("http://localhost/api/auth/users/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
        role: "ADMIN",
        password: "password123",
        confirmPassword: "password123",
        username: "User",
        phoneNumber: "123",
        address: "Street 1",
        description: "Test",
        logoPath: "/uploads/user-logos/actor-1/logo.webp",
        usernameDisplayColor: "#112233",
        priceListId: "price-list-1",
        permissions: ["BOOKING_VIEW", "BOOKING_CREATE"],
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.createUserWithPasswordMock).toHaveBeenCalledWith({
      actorUserId: "actor-1",
      companyId: "company-active",
      email: "user@example.com",
      role: "ADMIN",
      password: "password123",
      username: "User",
      phoneNumber: "123",
      address: "Street 1",
      description: "Test",
      logoPath: "/uploads/user-logos/actor-1/logo.webp",
      usernameDisplayColor: "#112233",
      priceListId: "price-list-1",
      permissions: ["BOOKING_VIEW", "BOOKING_CREATE"],
    });
  });

  it("returns 409 when helper reports an existing email", async () => {
    mocks.createUserWithPasswordMock.mockResolvedValueOnce({
      ok: false,
      reason: "EMAIL_ALREADY_EXISTS",
    });

    const req = new Request("http://localhost/api/auth/users/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
        role: "USER",
        password: "password123",
        confirmPassword: "password123",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "EMAIL_ALREADY_EXISTS",
    });
  });
});
