import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    signupWithEmailPasswordMock: vi.fn(),
    setSessionCookieMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/signup", () => ({
  signupWithEmailPassword: mocks.signupWithEmailPasswordMock,
}));

vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: mocks.setSessionCookieMock,
}));

import { POST } from "./route";

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.signupWithEmailPasswordMock.mockResolvedValue({
      ok: true,
      userId: "user-1",
      companyId: "company-1",
      sessionToken: "session-token",
      sessionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
  });

  it("returns 201, ok true, and sets session cookie on success", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");

    mocks.signupWithEmailPasswordMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-1",
      companyId: "company-1",
      sessionToken: "session-token",
      sessionExpiresAt: expiresAt,
    });

    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest-agent",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
        companyName: "My Company",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.signupWithEmailPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      companyName: "My Company",
      ip: "203.0.113.10",
      userAgent: "vitest-agent",
    });

    expect(mocks.setSessionCookieMock).toHaveBeenCalledTimes(1);
    expect(mocks.setSessionCookieMock).toHaveBeenCalledWith(
      res,
      "session-token",
      expiresAt
    );
  });

  it("returns 409 when EMAIL_ALREADY_EXISTS", async () => {
    mocks.signupWithEmailPasswordMock.mockResolvedValueOnce({
      ok: false,
      reason: "EMAIL_ALREADY_EXISTS",
    });

    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
        companyName: "My Company",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "EMAIL_ALREADY_EXISTS",
    });

    expect(mocks.setSessionCookieMock).not.toHaveBeenCalled();
  });

  it("returns 400 when INVALID_INPUT", async () => {
    mocks.signupWithEmailPasswordMock.mockResolvedValueOnce({
      ok: false,
      reason: "INVALID_INPUT",
    });

    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "",
        password: "short",
        companyName: "",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_INPUT",
    });

    expect(mocks.setSessionCookieMock).not.toHaveBeenCalled();
  });

  it("falls back to empty strings when json is malformed", async () => {
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest-agent",
      },
      body: "{",
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.signupWithEmailPasswordMock).toHaveBeenCalledWith({
      email: "",
      password: "",
      companyName: "",
      ip: null,
      userAgent: "vitest-agent",
    });
  });

  it("falls back to empty strings when fields are not strings", async () => {
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: 123,
        password: 456,
        companyName: 789,
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.signupWithEmailPasswordMock).toHaveBeenCalledWith({
      email: "",
      password: "",
      companyName: "",
      ip: null,
      userAgent: null,
    });
  });

  it("forwards only first x-forwarded-for and user-agent", async () => {
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "custom-agent",
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
      },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
        companyName: "My Company",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(201);

    expect(mocks.signupWithEmailPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      companyName: "My Company",
      ip: "198.51.100.1",
      userAgent: "custom-agent",
    });
  });
});