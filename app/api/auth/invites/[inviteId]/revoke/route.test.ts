import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    revokeInviteMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/inviteRevoke", () => ({
  revokeInvite: mocks.revokeInviteMock,
}));

import { POST } from "./route";

describe("POST /api/auth/invites/[inviteId]/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "actor-1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.revokeInviteMock.mockResolvedValue({ ok: true });
  });

  it("returns 401 and UNAUTHORIZED when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/auth/invites/invite-1/revoke", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ inviteId: "invite-1" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });

    expect(mocks.revokeInviteMock).not.toHaveBeenCalled();
  });

  it("returns 200 and ok true on success", async () => {
    const req = new Request("http://localhost/api/auth/invites/invite-1/revoke", {
      method: "POST",
      headers: {
        "user-agent": "vitest-agent",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    });

    const res = await POST(req, {
      params: Promise.resolve({ inviteId: "invite-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.revokeInviteMock).toHaveBeenCalledWith({
      actorUserId: "actor-1",
      inviteId: "invite-1",
      ip: "203.0.113.10",
      userAgent: "vitest-agent",
    });
  });

  it("returns 403 and FORBIDDEN when helper rejects actor permissions", async () => {
    mocks.revokeInviteMock.mockResolvedValueOnce({
      ok: false,
      reason: "FORBIDDEN",
    });

    const req = new Request("http://localhost/api/auth/invites/invite-1/revoke", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ inviteId: "invite-1" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });

  it("returns 404 and INVITE_NOT_FOUND when helper reports missing invite", async () => {
    mocks.revokeInviteMock.mockResolvedValueOnce({
      ok: false,
      reason: "INVITE_NOT_FOUND",
    });

    const req = new Request("http://localhost/api/auth/invites/invite-1/revoke", {
      method: "POST",
    });

    const res = await POST(req, {
      params: Promise.resolve({ inviteId: "invite-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVITE_NOT_FOUND",
    });
  });

  it("passes empty inviteId when route param is blank after trim", async () => {
    mocks.revokeInviteMock.mockResolvedValueOnce({
      ok: false,
      reason: "INVITE_NOT_FOUND",
    });

    const req = new Request("http://localhost/api/auth/invites/%20/revoke", {
      method: "POST",
      headers: {
        "user-agent": "vitest-agent",
      },
    });

    const res = await POST(req, {
      params: Promise.resolve({ inviteId: "   " }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVITE_NOT_FOUND",
    });

    expect(mocks.revokeInviteMock).toHaveBeenCalledWith({
      actorUserId: "actor-1",
      inviteId: "",
      ip: null,
      userAgent: "vitest-agent",
    });
  });
});
