import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  requireFullAccessMembershipMock: vi.fn(),
  findManyMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/products/pricelistAccess", () => ({
  requireFullAccessMembership: mocks.requireFullAccessMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    customPickupAddress: {
      findMany: mocks.findManyMock,
      create: mocks.createMock,
    },
  },
}));

import { NextResponse } from "next/server";
import { GET, POST } from "./route";

describe("GET /api/pickup-addresses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller lacks full access", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    });

    const response = await GET(new Request("http://localhost/api/pickup-addresses"));

    expect(response.status).toBe(403);
    expect(mocks.findManyMock).not.toHaveBeenCalled();
  });

  it("lists all addresses with their user assignments", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.findManyMock.mockResolvedValue([
      {
        id: "cpa-1",
        name: "Power Storo",
        address: "Storo Storsenter 1",
        latitude: 59.945,
        longitude: 10.7669,
        isActive: true,
        users: [{ user: { id: "user-1", email: "a@example.com", username: "A" } }],
      },
    ]);

    const response = await GET(new Request("http://localhost/api/pickup-addresses"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.pickupAddresses).toHaveLength(1);
    expect(json.pickupAddresses[0].users).toEqual([{ id: "user-1", email: "a@example.com", username: "A" }]);
  });
});

describe("POST /api/pickup-addresses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller lacks full access", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    });

    const response = await POST(
      new Request("http://localhost/api/pickup-addresses", {
        method: "POST",
        body: JSON.stringify({ name: "Power Storo", address: "Addr", latitude: 1, longitude: 1 }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createMock).not.toHaveBeenCalled();
  });

  it("rejects invalid coordinates with a 400", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });

    const response = await POST(
      new Request("http://localhost/api/pickup-addresses", {
        method: "POST",
        body: JSON.stringify({ name: "Power Storo", address: "Addr", latitude: 999, longitude: 1 }),
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.reason).toBe("INVALID_LATITUDE");
    expect(mocks.createMock).not.toHaveBeenCalled();
  });

  it("creates a pickup address with the given user assignments", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.createMock.mockResolvedValue({ id: "cpa-1" });

    const response = await POST(
      new Request("http://localhost/api/pickup-addresses", {
        method: "POST",
        body: JSON.stringify({
          name: "Power Storo",
          address: "Storo Storsenter 1",
          latitude: 59.945,
          longitude: 10.7669,
          userIds: ["user-1", "user-2"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createMock).toHaveBeenCalledWith({
      data: {
        name: "Power Storo",
        address: "Storo Storsenter 1",
        latitude: 59.945,
        longitude: 10.7669,
        icon: "storefront",
        color: "blue",
        users: {
          create: [{ userId: "user-1" }, { userId: "user-2" }],
        },
      },
    });
    const json = await response.json();
    expect(json).toEqual({ ok: true, pickupAddressId: "cpa-1" });
  });
});
