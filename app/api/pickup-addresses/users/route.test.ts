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
  prisma: { user: { findMany: mocks.findManyMock } },
}));

import { NextResponse } from "next/server";
import { GET } from "./route";

describe("GET /api/pickup-addresses/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller lacks full access", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    });

    const response = await GET(new Request("http://localhost/api/pickup-addresses/users"));

    expect(response.status).toBe(403);
  });

  it("lists active users by id/email/username along with their current main pickup address", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.findManyMock.mockResolvedValue([
      {
        id: "user-1",
        email: "a@example.com",
        username: "A",
        mainPickupAddress: { id: "cpa-9", name: "Other Depot" },
      },
      { id: "user-2", email: "b@example.com", username: "B", mainPickupAddress: null },
    ]);

    const response = await GET(new Request("http://localhost/api/pickup-addresses/users"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      users: [
        {
          id: "user-1",
          email: "a@example.com",
          username: "A",
          mainPickupAddress: { id: "cpa-9", name: "Other Depot" },
        },
        { id: "user-2", email: "b@example.com", username: "B", mainPickupAddress: null },
      ],
    });
    expect(mocks.findManyMock).toHaveBeenCalledWith({
      where: { status: "ACTIVE" },
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        username: true,
        mainPickupAddress: { select: { id: true, name: true } },
      },
    });
  });
});
