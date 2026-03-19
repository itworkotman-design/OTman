import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    return {
        acceptInviteMock: vi.fn(),
        setSessionCookieMock: vi.fn(),
    };
});

vi.mock("@/lib/auth/inviteAccept", () => ({
    acceptInvite: mocks.acceptInviteMock,
}));

vi.mock("@/lib/auth/session", () => ({
    setSessionCookie: mocks.setSessionCookieMock,
}));

import { POST } from "./route";

describe("POST /api/auth/invites/accept", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.acceptInviteMock.mockResolvedValue({
            ok: true,
            userId: "user-1",
            companyId: "company-1",
            sessionToken: "session-token",
            sessionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
        });
    });

    it("returns 200, ok true, and sets session cookie on success", async () => {
        const expiresAt = new Date("2030-01-01T00:00:00.000Z");

        mocks.acceptInviteMock.mockResolvedValueOnce({
            ok: true,
            userId: "user-1",
            companyId: "company-1",
            sessionToken: "session-token",
            sessionExpiresAt: expiresAt,
        });

        const req = new Request("http://localhost/api/auth/invites/accept", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": "vitest-agent",
                "x-forwarded-for": "203.0.113.10, 10.0.0.1",
            },
            body: JSON.stringify({
                token: "invite-token",
                password: "valid-pass-123",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });

        expect(mocks.acceptInviteMock).toHaveBeenCalledWith({
            token: "invite-token",
            password: "valid-pass-123",
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

    it("returns 400 and INVALID_INPUT when helper reports invalid input", async () => {
        mocks.acceptInviteMock.mockResolvedValueOnce({
            ok: false,
            reason: "INVALID_INPUT",
        });

        const req = new Request("http://localhost/api/auth/invites/accept", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                token: "",
                password: "",
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

    it("returns 400 and INVALID_INVITE when helper reports invalid invite", async () => {
        mocks.acceptInviteMock.mockResolvedValueOnce({
            ok: false,
            reason: "INVALID_INVITE",
        });

        const req = new Request("http://localhost/api/auth/invites/accept", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                token: "bad-token",
                password: "valid-pass-123",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({
            ok: false,
            reason: "INVALID_INVITE",
        });

        expect(mocks.setSessionCookieMock).not.toHaveBeenCalled();
    });

    it("returns 400 and EXPIRED_INVITE when helper reports expired invite", async () => {
        mocks.acceptInviteMock.mockResolvedValueOnce({
            ok: false,
            reason: "EXPIRED_INVITE",
        });

        const req = new Request("http://localhost/api/auth/invites/accept", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                token: "expired-token",
                password: "valid-pass-123",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({
            ok: false,
            reason: "EXPIRED_INVITE",
        });

        expect(mocks.setSessionCookieMock).not.toHaveBeenCalled();
    });

    it("returns 409 and EMAIL_ALREADY_MEMBER when helper reports existing membership", async () => {
        mocks.acceptInviteMock.mockResolvedValueOnce({
            ok: false,
            reason: "EMAIL_ALREADY_MEMBER",
        });

        const req = new Request("http://localhost/api/auth/invites/accept", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                token: "invite-token",
                password: "valid-pass-123",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(409);
        await expect(res.json()).resolves.toEqual({
            ok: false,
            reason: "EMAIL_ALREADY_MEMBER",
        });

        expect(mocks.setSessionCookieMock).not.toHaveBeenCalled();
    });

    it("falls back to empty strings when json is malformed", async () => {
        const req = new Request("http://localhost/api/auth/invites/accept", {
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

        expect(mocks.acceptInviteMock).toHaveBeenCalledWith({
            token: "",
            password: "",
            ip: "203.0.113.11",
            userAgent: "vitest-agent",
        });
    });

    it("falls back to empty strings when token and password are not strings", async () => {
        const req = new Request("http://localhost/api/auth/invites/accept", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                token: 123,
                password: 456,
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });

        expect(mocks.acceptInviteMock).toHaveBeenCalledWith({
            token: "",
            password: "",
            ip: null,
            userAgent: null,
        });
    });

    it("forwards only the first x-forwarded-for value and the user-agent header", async () => {
        const req = new Request("http://localhost/api/auth/invites/accept", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": "custom-agent/1.0",
                "x-forwarded-for": "198.51.100.7, 10.0.0.1, 10.0.0.2",
            },
            body: JSON.stringify({
                token: "invite-token",
                password: "valid-pass-123",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });

        expect(mocks.acceptInviteMock).toHaveBeenCalledWith({
            token: "invite-token",
            password: "valid-pass-123",
            ip: "198.51.100.7",
            userAgent: "custom-agent/1.0",
        });
    });
});
