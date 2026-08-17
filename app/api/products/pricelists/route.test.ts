import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  countMock: vi.fn(),
  findFirstMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  createMock: vi.fn(),
  createManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: {
      findMany: mocks.findManyMock,
      findUnique: mocks.findUniqueMock,
      count: mocks.countMock,
      findFirst: mocks.findFirstMock,
    },
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { GET, POST } from "./route";

describe("POST /api/products/pricelists", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transactionMock.mockImplementation(
      async (
        callback: (tx: {
          priceList: { create: typeof mocks.createMock };
          priceListSpecialOption: { createMany: typeof mocks.createManyMock };
        }) => Promise<unknown>,
      ) =>
        callback({
          priceList: {
            create: mocks.createMock,
          },
          priceListSpecialOption: {
            createMany: mocks.createManyMock,
          },
        }),
    );
  });

  it("adds the missing automatic first-step XTRA option when copying a price list", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
    mocks.findUniqueMock.mockResolvedValue({
      id: "source-price-list",
      description: "__PRICE_LIST_SETTINGS__:{}",
      specialOptions: [
        {
          type: "XTRA",
          code: "XTRA",
          label: "XTRA",
          description: "Ekstra innbæring",
          customerPrice: 229,
          subcontractorPrice: 100,
          discountAmount: null,
          discountEndsAt: null,
          isActive: true,
          sortOrder: 1,
        },
      ],
    });
    mocks.countMock.mockResolvedValue(1);
    mocks.findFirstMock.mockResolvedValue(null);
    mocks.createMock.mockResolvedValue({
      id: "new-price-list",
      name: "Pricelist 2",
      code: "PRICE_2",
    });
    mocks.createManyMock.mockResolvedValue({
      count: 2,
    });

    const response = await POST(
      new Request("http://localhost/api/products/pricelists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourcePriceListId: "source-price-list",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          priceListId: "new-price-list",
          type: "XTRA",
          code: "XTRA",
          description: "Ekstra innbæring",
          sortOrder: 1,
        }),
        expect.objectContaining({
          priceListId: "new-price-list",
          type: "XTRA",
          code: "XTRAFIRST",
          description: "Ekstra levering",
          sortOrder: 2,
        }),
      ],
    });
  });

  it("returns FORBIDDEN when a non-full-access member tries to create a price list", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER" });

    const response = await POST(
      new Request("http://localhost/api/products/pricelists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePriceListId: "source-price-list" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/products/pricelists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a member's assigned lists for ?mine=true without requiring full access", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      membershipPriceLists: [{ priceListId: "price-list-1" }],
    });
    mocks.findManyMock.mockResolvedValue([{ id: "price-list-1", name: "List 1", code: "L1" }]);

    const response = await GET(
      new Request("http://localhost/api/products/pricelists?mine=true"),
    );

    expect(response.status).toBe(200);
    expect(mocks.findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, id: { in: ["price-list-1"] } } }),
    );
  });

  it("returns FORBIDDEN for the full unfiltered list when the caller lacks full access", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER" });

    const response = await GET(new Request("http://localhost/api/products/pricelists"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(mocks.findManyMock).not.toHaveBeenCalled();
  });

  it("returns the full unfiltered list for a full-access member", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "OWNER" });
    mocks.findManyMock.mockResolvedValue([{ id: "price-list-1", name: "List 1", code: "L1" }]);

    const response = await GET(new Request("http://localhost/api/products/pricelists"));

    expect(response.status).toBe(200);
    expect(mocks.findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });
});
