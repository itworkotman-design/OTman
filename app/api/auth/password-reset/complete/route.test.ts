import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    completePasswordResetMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/passwordResetComplete", () => ({
  completePasswordReset: mocks.completePasswordResetMock,
}));

import { POST } from "./route";

describe("POST /api/auth/password-reset/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.completePasswordResetMock.mockResolvedValue({ ok: true });
  });

  it("returns 200 and ok true on success", async () => {
    const req = new Request(
      "http://localhost/api/auth/password-reset/complete",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "vitest-agent",
          "x-forwarded-for": "203.0.113.20, 10.0.0.1",
        },
        body: JSON.stringify({
          token: "reset-token",
          newPassword: "StrongPassword123",
        }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.completePasswordResetMock).toHaveBeenCalledWith({
      token: "reset-token",
      newPassword: "StrongPassword123",
      ip: "203.0.113.20",
      userAgent: "vitest-agent",
    });
  });

  it("returns 400 and INVALID_INPUT when helper reports invalid input", async () => {
    mocks.completePasswordResetMock.mockResolvedValueOnce({
      ok: false,
      reason: "INVALID_INPUT",
    });

    const req = new Request(
      "http://localhost/api/auth/password-reset/complete",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: "",
          newPassword: "",
        }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_INPUT",
    });
  });

  it("returns 400 and INVALID_TOKEN when helper reports invalid token", async () => {
    mocks.completePasswordResetMock.mockResolvedValueOnce({
      ok: false,
      reason: "INVALID_TOKEN",
    });

    const req = new Request(
      "http://localhost/api/auth/password-reset/complete",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: "bad-token",
          newPassword: "StrongPassword123",
        }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_TOKEN",
    });
  });

  it("returns 400 and EXPIRED_TOKEN when helper reports expired token", async () => {
    mocks.completePasswordResetMock.mockResolvedValueOnce({
      ok: false,
      reason: "EXPIRED_TOKEN",
    });

    const req = new Request(
      "http://localhost/api/auth/password-reset/complete",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: "expired-token",
          newPassword: "StrongPassword123",
        }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "EXPIRED_TOKEN",
    });
  });

  it("falls back to empty token and password when json is malformed", async () => {
    const req = new Request(
      "http://localhost/api/auth/password-reset/complete",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "vitest-agent",
        },
        body: "{",
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.completePasswordResetMock).toHaveBeenCalledWith({
      token: "",
      newPassword: "",
      ip: null,
      userAgent: "vitest-agent",
    });
  });

  it("falls back to empty token and password when fields are not strings", async () => {
    const req = new Request(
      "http://localhost/api/auth/password-reset/complete",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: 123,
          newPassword: 456,
        }),
      }
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.completePasswordResetMock).toHaveBeenCalledWith({
      token: "",
      newPassword: "",
      ip: null,
      userAgent: null,
    });
  });
});