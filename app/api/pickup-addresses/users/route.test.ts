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

  it("only returns users who hold order-creator booking access in at least one active membership", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.findManyMock.mockResolvedValue([
      {
        // Order creator: Booking enabled at Admin level, plain company role.
        id: "user-1",
        email: "creator@example.com",
        username: "Creator",
        mainPickupAddress: { id: "cpa-9", name: "Other Depot" },
        memberships: [
          {
            role: "USER",
            permissions: [{ permission: "BOOKING_VIEW" }, { permission: "BOOKING_CREATE" }],
          },
        ],
      },
      {
        // Subcontractor: Booking view-only, no create — must be excluded.
        id: "user-2",
        email: "subcontractor@example.com",
        username: "Sub",
        mainPickupAddress: null,
        memberships: [{ role: "USER", permissions: [{ permission: "BOOKING_VIEW" }] }],
      },
      {
        // No booking access at all — must be excluded.
        id: "user-3",
        email: "noaccess@example.com",
        username: null,
        mainPickupAddress: null,
        memberships: [{ role: "USER", permissions: [] }],
      },
      {
        // Full-access company Owner — already sees every address, so not an
        // "order creator" assignment target — must be excluded.
        id: "user-4",
        email: "owner@example.com",
        username: "Owner",
        mainPickupAddress: null,
        memberships: [{ role: "OWNER", permissions: [] }],
      },
      {
        // Order creator via a second, non-active-first membership.
        id: "user-5",
        email: "multi@example.com",
        username: null,
        mainPickupAddress: null,
        memberships: [
          { role: "USER", permissions: [] },
          { role: "USER", permissions: [{ permission: "BOOKING_VIEW" }, { permission: "BOOKING_CREATE" }] },
        ],
      },
    ]);

    const response = await GET(new Request("http://localhost/api/pickup-addresses/users"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      users: [
        {
          id: "user-1",
          email: "creator@example.com",
          username: "Creator",
          mainPickupAddress: { id: "cpa-9", name: "Other Depot" },
        },
        {
          id: "user-5",
          email: "multi@example.com",
          username: null,
          mainPickupAddress: null,
        },
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
        memberships: {
          where: { status: "ACTIVE" },
          select: {
            role: true,
            permissions: { select: { permission: true } },
          },
        },
      },
    });
  });
});
