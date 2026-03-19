import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    requestPasswordResetMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/passwordResetRequest", () => ({
  requestPasswordReset: mocks.requestPasswordResetMock,
}));

import { POST } from "./route";

describe("POST /api/auth/password-reset/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestPasswordResetMock.mockResolvedValue({ ok: true });
  });

  it("returns 200 and ok true on generic success", async () => {
    const req = new Request("http://localhost/api/auth/password-reset/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest-agent",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      body: JSON.stringify({
        email: "user@example.com",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.requestPasswordResetMock).toHaveBeenCalledWith({
      email: "user@example.com",
      ip: "203.0.113.10",
      userAgent: "vitest-agent",
    });
  });

  it("returns 429 and reason when helper reports RATE_LIMITED", async () => {
    mocks.requestPasswordResetMock.mockResolvedValueOnce({
      ok: false,
      reason: "RATE_LIMITED",
    });

    const req = new Request("http://localhost/api/auth/password-reset/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "user@example.com",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "RATE_LIMITED",
    });
  });

  it("falls back to empty email when json is malformed", async () => {
    const req = new Request("http://localhost/api/auth/password-reset/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest-agent",
      },
      body: "{",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.requestPasswordResetMock).toHaveBeenCalledWith({
      email: "",
      ip: null,
      userAgent: "vitest-agent",
    });
  });

  it("falls back to empty email when email is not a string", async () => {
    const req = new Request("http://localhost/api/auth/password-reset/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: 123,
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.requestPasswordResetMock).toHaveBeenCalledWith({
      email: "",
      ip: null,
      userAgent: null,
    });
  });
});