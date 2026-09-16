import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  getActiveMembershipMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    customPickupAddress: {
      findFirst: mocks.findFirstMock,
    },
  },
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

import { getVisibleCustomPickupAddress } from "./visibility";

describe("getVisibleCustomPickupAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an explicit assignment for a non-full-access caller", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({ role: "USER" });
    mocks.findFirstMock.mockResolvedValue(null);

    await getVisibleCustomPickupAddress("cpa-1", "user-1", "company-1");

    expect(mocks.findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "cpa-1",
          isActive: true,
          users: { some: { userId: "user-1" } },
        },
      }),
    );
  });

  it("skips the assignment requirement for an OWNER/ADMIN caller, matching the address picker list", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({ role: "OWNER" });
    mocks.findFirstMock.mockResolvedValue(null);

    await getVisibleCustomPickupAddress("cpa-1", "user-1", "company-1");

    expect(mocks.findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "cpa-1",
          isActive: true,
        },
      }),
    );
  });

  it("still requires assignment when there's no active membership for that company", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue(null);
    mocks.findFirstMock.mockResolvedValue(null);

    await getVisibleCustomPickupAddress("cpa-1", "user-1", "company-1");

    expect(mocks.findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "cpa-1",
          isActive: true,
          users: { some: { userId: "user-1" } },
        },
      }),
    );
  });
});
