import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    loginWithEmailPasswordMock: vi.fn(),
    setSessionCookieMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/login", () => ({
  loginWithEmailPassword: mocks.loginWithEmailPasswordMock,
}));

vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: mocks.setSessionCookieMock,
}));

import { POST } from "./route";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.loginWithEmailPasswordMock.mockResolvedValue({
      ok: true,
      userId: "user-1",
      sessionToken: "session-token",
      sessionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
  });

  it("returns 200, ok true, and sets session cookie on success", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");

    mocks.loginWithEmailPasswordMock.mockResolvedValueOnce({
      ok: true,
      userId: "user-1",
      sessionToken: "session-token",
      sessionExpiresAt: expiresAt,
    });

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest-agent",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      body: JSON.stringify({
        email: "user@example.com",
        password: "correct-password",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.loginWithEmailPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "correct-password",
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

  it("returns 429 and reason when helper reports RATE_LIMITED", async () => {
    mocks.loginWithEmailPasswordMock.mockResolvedValueOnce({
      ok: false,
      reason: "RATE_LIMITED",
    });

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
        password: "wrong-password",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "RATE_LIMITED",
    });

    expect(mocks.setSessionCookieMock).not.toHaveBeenCalled();
  });

  it("returns 401 and reason when helper reports INVALID_CREDENTIALS", async () => {
    mocks.loginWithEmailPasswordMock.mockResolvedValueOnce({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
        password: "wrong-password",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });

    expect(mocks.setSessionCookieMock).not.toHaveBeenCalled();
  });

  it("falls back to empty strings when json is malformed", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest-agent",
        "x-forwarded-for": "203.0.113.11, 10.0.0.1",
      },
      body: "{",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.loginWithEmailPasswordMock).toHaveBeenCalledWith({
      email: "",
      password: "",
      ip: "203.0.113.11",
      userAgent: "vitest-agent",
    });
  });

  it("falls back to empty strings when email and password are not strings", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: 123,
        password: 456,
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.loginWithEmailPasswordMock).toHaveBeenCalledWith({
      email: "",
      password: "",
      ip: null,
      userAgent: null,
    });
  });

  it("forwards only the first x-forwarded-for value and the user-agent header", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "custom-agent/1.0",
        "x-forwarded-for": "198.51.100.7, 10.0.0.1, 10.0.0.2",
      },
      body: JSON.stringify({
        email: "user@example.com",
        password: "correct-password",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.loginWithEmailPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "correct-password",
      ip: "198.51.100.7",
      userAgent: "custom-agent/1.0",
    });
  });
});