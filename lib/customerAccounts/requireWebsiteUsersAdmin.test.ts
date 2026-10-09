import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthenticatedSession: vi.fn(), membershipFindFirst: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSession: mocks.getAuthenticatedSession }));
vi.mock("@/lib/db", () => ({ prisma: { membership: { findFirst: mocks.membershipFindFirst } } }));

import { requireWebsiteUsersAdmin } from "./requireWebsiteUsersAdmin";

const req = new Request("http://x");
const membership = (over: Record<string, unknown>) => ({
  id: "m1",
  role: "USER",
  appAccess: [],
  user: { username: "Admin", email: "admin@otman.no" },
  ...over,
});

describe("requireWebsiteUsersAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSession.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
  });

  it("lets an owner in, with the company and an audit actor", async () => {
    mocks.membershipFindFirst.mockResolvedValue(membership({ role: "OWNER" }));

    expect(await requireWebsiteUsersAdmin(req)).toEqual({
      ok: true,
      companyId: "c1",
      actor: { membershipId: "m1", name: "Admin", email: "admin@otman.no", source: "USER" },
    });
    expect(mocks.membershipFindFirst.mock.calls[0][0].where).toEqual({ userId: "u1", companyId: "c1", status: "ACTIVE" });
  });

  it("lets a User management admin in", async () => {
    mocks.membershipFindFirst.mockResolvedValue(membership({ appAccess: [{ module: "USER_MANAGEMENT", enabled: true, level: "ADMIN" }] }));

    expect((await requireWebsiteUsersAdmin(req)).ok).toBe(true);
  });

  it("keeps out a User management viewer, a company ADMIN without the grant, and no membership", async () => {
    mocks.membershipFindFirst.mockResolvedValue(membership({ appAccess: [{ module: "USER_MANAGEMENT", enabled: true, level: "VIEWER" }] }));
    expect(await requireWebsiteUsersAdmin(req)).toEqual({ ok: false, status: 403, reason: "FORBIDDEN" });

    mocks.membershipFindFirst.mockResolvedValue(membership({ role: "ADMIN" }));
    expect((await requireWebsiteUsersAdmin(req)).ok).toBe(false);

    mocks.membershipFindFirst.mockResolvedValue(null);
    expect((await requireWebsiteUsersAdmin(req)).ok).toBe(false);
  });

  it("needs a session and a selected company", async () => {
    mocks.getAuthenticatedSession.mockResolvedValue(null);
    expect(await requireWebsiteUsersAdmin(req)).toEqual({ ok: false, status: 401, reason: "UNAUTHORIZED" });

    mocks.getAuthenticatedSession.mockResolvedValue({ userId: "u1", activeCompanyId: null });
    expect(await requireWebsiteUsersAdmin(req)).toEqual({ ok: false, status: 409, reason: "TENANT_SELECTION_REQUIRED" });
  });
});
