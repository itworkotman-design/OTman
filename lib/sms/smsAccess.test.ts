import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSession: mocks.getAuthenticatedSessionMock }));
vi.mock("@/lib/db", () => ({ prisma: { membership: { findFirst: mocks.membershipFindFirstMock } } }));

import { requireSmsAdmin } from "./smsAccess";

const req = new Request("http://localhost/api/sms/templates");

describe("requireSmsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u-1", activeCompanyId: "c-1" });
  });

  it("returns 401 without a session and 409 without an active company", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValueOnce(null);
    const unauth = await requireSmsAdmin(req);
    expect(unauth.ok ? null : unauth.response.status).toBe(401);

    mocks.getAuthenticatedSessionMock.mockResolvedValueOnce({ userId: "u-1", activeCompanyId: null });
    const noTenant = await requireSmsAdmin(req);
    expect(noTenant.ok ? null : noTenant.response.status).toBe(409);
  });

  it("returns 403 for a plain USER membership (stores, subcontractors)", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({ id: "m-1", role: "USER", user: { username: "store", email: "s@x.no" } });
    const result = await requireSmsAdmin(req);
    expect(result.ok ? null : result.response.status).toBe(403);
  });

  it("allows OWNER and ADMIN and returns an event actor", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({ id: "m-1", role: "ADMIN", user: { username: "Ola", email: "o@otman.no" } });
    const result = await requireSmsAdmin(req);
    expect(result).toEqual({
      ok: true,
      companyId: "c-1",
      membershipId: "m-1",
      actor: { membershipId: "m-1", name: "Ola", email: "o@otman.no", source: "USER" },
    });
    expect(mocks.membershipFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u-1", companyId: "c-1", status: "ACTIVE" } }),
    );
  });
});
