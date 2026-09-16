import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  requireFullAccessMembershipMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/products/pricelistAccess", () => ({
  requireFullAccessMembership: mocks.requireFullAccessMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: { company: { findMany: mocks.findManyMock } },
}));

import { NextResponse } from "next/server";
import { GET } from "./route";

describe("GET /api/companies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller lacks full access", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    });

    const response = await GET(new Request("http://localhost/api/companies"));

    expect(response.status).toBe(403);
  });

  it("lists companies by id/name", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.findManyMock.mockResolvedValue([{ id: "company-1", name: "Otman Oslo" }]);

    const response = await GET(new Request("http://localhost/api/companies"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, companies: [{ id: "company-1", name: "Otman Oslo" }] });
  });
});
