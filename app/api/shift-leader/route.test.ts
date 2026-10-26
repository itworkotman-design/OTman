import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
  membershipFindManyMock: vi.fn(),
  shiftLeaderFindUniqueMock: vi.fn(),
  shiftLeaderUpsertMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findUnique: mocks.membershipFindUniqueMock,
      findMany: mocks.membershipFindManyMock,
    },
    shiftLeader: {
      findUnique: mocks.shiftLeaderFindUniqueMock,
      upsert: mocks.shiftLeaderUpsertMock,
    },
    user: { findUnique: vi.fn() },
  },
}));

import { GET, POST } from "./route";
import { GET as GET_ADMINS } from "./admins/route";

const COMPANY_ID = "company-1";
const today = new Date().toISOString().slice(0, 10);

function request(method = "GET", body?: unknown) {
  return new Request("http://localhost/api/shift-leader", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function asMember(role: "OWNER" | "ADMIN" | "USER") {
  mocks.membershipFindUniqueMock.mockResolvedValue({ role, status: "ACTIVE" });
}

describe("/api/shift-leader access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: COMPANY_ID,
    });
    mocks.shiftLeaderFindUniqueMock.mockResolvedValue({
      userId: "leader-1",
      username: "jane",
      date: today,
    });
    mocks.membershipFindManyMock.mockResolvedValue([]);
  });

  it("returns the shift leader to company admins", async () => {
    asMember("ADMIN");

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      shiftLeader: { userId: "leader-1", username: "jane" },
    });
  });

  it("hides the shift leader from non-admin members (subcontractors / order creators)", async () => {
    asMember("USER");

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(mocks.shiftLeaderFindUniqueMock).not.toHaveBeenCalled();
  });

  it("does not let non-admin members set the shift leader", async () => {
    asMember("USER");

    const response = await POST(request("POST", {}));

    expect(response.status).toBe(403);
    expect(mocks.shiftLeaderUpsertMock).not.toHaveBeenCalled();
  });

  it("does not list admin candidates to non-admin members", async () => {
    asMember("USER");

    const response = await GET_ADMINS(request());

    expect(response.status).toBe(403);
    expect(mocks.membershipFindManyMock).not.toHaveBeenCalled();
  });

  it("treats inactive admin memberships as non-admin", async () => {
    mocks.membershipFindUniqueMock.mockResolvedValue({ role: "OWNER", status: "DISABLED" });

    const response = await GET(request());

    expect(response.status).toBe(403);
  });
});
