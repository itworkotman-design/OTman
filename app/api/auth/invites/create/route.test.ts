import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    return {
        getAuthenticatedSessionMock: vi.fn(),
        createInviteMock: vi.fn(),
    };
});

vi.mock("@/lib/auth/session", () => ({
    getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/inviteCreate", () => ({
    createInvite: mocks.createInviteMock,
}));

import { POST } from "./route";

describe("POST /api/auth/invites/create", () => {
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

        mocks.createInviteMock.mockResolvedValue({ ok: true });
    });

    it("returns 401 and UNAUTHORIZED when no session exists", async () => {
        mocks.getAuthenticatedSessionMock.mockResolvedValueOnce(null);

        const req = new Request("http://localhost/api/auth/invites/create", {
            method: "POST",
            body: JSON.stringify({
                email: "user@example.com",
                role: "USER",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(401);
        await expect(res.json()).resolves.toEqual({
            ok: false,
            reason: "UNAUTHORIZED",
        });

        expect(mocks.createInviteMock).not.toHaveBeenCalled();
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

        const req = new Request("http://localhost/api/auth/invites/create", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                email: "user@example.com",
                role: "USER",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(409);
        await expect(res.json()).resolves.toEqual({
            ok: false,
            reason: "TENANT_SELECTION_REQUIRED",
        });

        expect(mocks.createInviteMock).not.toHaveBeenCalled();
    });

    it("returns 201 and ok true on success", async () => {
        const req = new Request("http://localhost/api/auth/invites/create", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": "vitest-agent",
                "x-forwarded-for": "203.0.113.10, 10.0.0.1",
            },
            body: JSON.stringify({
                companyId: "company-body-ignored",
                email: "user@example.com",
                role: "ADMIN",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(201);
        await expect(res.json()).resolves.toEqual({ ok: true });

        expect(mocks.createInviteMock).toHaveBeenCalledWith({
            actorUserId: "actor-1",
            companyId: "company-active",
            email: "user@example.com",
            role: "ADMIN",
            ip: "203.0.113.10",
            userAgent: "vitest-agent",
        });
    });

    it("returns 403 and FORBIDDEN when helper rejects actor permissions", async () => {
        mocks.createInviteMock.mockResolvedValueOnce({
            ok: false,
            reason: "FORBIDDEN",
        });

        const req = new Request("http://localhost/api/auth/invites/create", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                email: "user@example.com",
                role: "OWNER",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toEqual({
            ok: false,
            reason: "FORBIDDEN",
        });
    });

    it("returns 400 and INVALID_INPUT when helper reports invalid input", async () => {
        mocks.createInviteMock.mockResolvedValueOnce({
            ok: false,
            reason: "INVALID_INPUT",
        });

        const req = new Request("http://localhost/api/auth/invites/create", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                email: "user@example.com",
                role: "USER",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({
            ok: false,
            reason: "INVALID_INPUT",
        });
    });

    it("falls back to empty strings when json is malformed", async () => {
        mocks.createInviteMock.mockResolvedValueOnce({
            ok: false,
            reason: "INVALID_INPUT",
        });

        const req = new Request("http://localhost/api/auth/invites/create", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": "vitest-agent",
            },
            body: "{",
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({
            ok: false,
            reason: "INVALID_INPUT",
        });

        expect(mocks.createInviteMock).toHaveBeenCalledWith({
            actorUserId: "actor-1",
            companyId: "company-active",
            email: "",
            role: "",
            ip: null,
            userAgent: "vitest-agent",
        });
    });

    it("falls back to empty strings when body fields are not strings", async () => {
        mocks.createInviteMock.mockResolvedValueOnce({
            ok: false,
            reason: "INVALID_INPUT",
        });

        const req = new Request("http://localhost/api/auth/invites/create", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                companyId: 123,
                email: true,
                role: null,
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({
            ok: false,
            reason: "INVALID_INPUT",
        });

        expect(mocks.createInviteMock).toHaveBeenCalledWith({
            actorUserId: "actor-1",
            companyId: "company-active",
            email: "",
            role: "",
            ip: null,
            userAgent: null,
        });
    });
});
