import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { customPickupAddress: { findMany: mocks.findManyMock } },
}));

import { GET } from "./route";

describe("GET /api/site/pickup-addresses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the minimal, public-safe fields for active addresses", async () => {
    mocks.findManyMock.mockResolvedValue([
      {
        id: "1",
        name: "Power Grünerløkka",
        address: "Thorvald Meyers gate 1, 0472 Oslo",
        icon: "power",
        color: "amber",
      },
    ]);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual({
      ok: true,
      addresses: [
        {
          id: "1",
          name: "Power Grünerløkka",
          address: "Thorvald Meyers gate 1, 0472 Oslo",
          icon: "power",
          color: "amber",
        },
      ],
    });
    expect(mocks.findManyMock).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true, icon: true, color: true },
    });
  });

  it("returns an empty list when there are no saved addresses", async () => {
    mocks.findManyMock.mockResolvedValue([]);

    const json = await (await GET()).json();

    expect(json).toEqual({ ok: true, addresses: [] });
  });
});
