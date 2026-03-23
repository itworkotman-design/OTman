import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    findFirstMock: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.findFirstMock,
    },
  },
}));

import { getActiveMembership } from "./membership";

describe("getActiveMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no active membership exists", async () => {
    mocks.findFirstMock.mockResolvedValue(null);

    const result = await getActiveMembership({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).toBeNull();

    expect(mocks.findFirstMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        companyId: "company-1",
        status: "ACTIVE",
      },
      select: {
        userId: true,
        companyId: true,
        role: true,
        status: true,
        permissions: {
          select: {
            permission: true,
          },
        },
      },
    });
  });

  it("returns the active membership when one exists", async () => {
    mocks.findFirstMock.mockResolvedValue({
      userId: "user-1",
      companyId: "company-1",
      role: "ADMIN",
      status: "ACTIVE",
    });

    const result = await getActiveMembership({
      userId: "user-1",
      companyId: "company-1",
    });

    expect(result).toEqual({
      userId: "user-1",
      companyId: "company-1",
      role: "ADMIN",
      status: "ACTIVE",
      permissions: [],
    });
  });
});