import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindManyMock: vi.fn(),
  priceListFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findMany: mocks.orderFindManyMock },
    priceList: { findMany: mocks.priceListFindManyMock },
  },
}));

import { GET } from "./route";

const API_KEY = "accounting-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const saved = { ...process.env };

function get(query: string, key = API_KEY) {
  return GET(
    new Request(`http://localhost/api/integrations/accounting/orders?${query}`, {
      headers: { Authorization: `Bearer ${key}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

const order = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  displayId: Number(id.replace(/\D/g, "")),
  status: "completed",
  deliveryDate: "2026-11-02",
  priceExVat: 1000,
  priceSubcontractor: 600,
  pricingSnapshot: null,
  rabatt: null,
  leggTil: null,
  subcontractorMinus: null,
  subcontractorPlus: null,
  websiteOrderKind: null,
  isWebsiteOrder: false,
  productCardsSnapshot: null,
  items: [],
  subcontractor: "NORDLINE AS",
  subcontractorMembershipId: "m-partner",
  priceListId: "pl-1",
  createdByMembershipId: "m-creator",
  customerMembershipId: null,
  createdByMembership: { user: { username: "POWER Rud", email: "rud@power.no" } },
  customerMembership: null,
  updatedAt: new Date("2026-11-02T10:00:00.000Z"),
  ...extra,
});

describe("GET /api/integrations/accounting/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ACCOUNTING_API_KEY = API_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
    mocks.priceListFindManyMock.mockResolvedValue([{ id: "pl-1", name: "Hvitevarer prisliste" }]);
  });

  afterAll(() => {
    process.env = { ...saved };
  });

  it("rejects a wrong key", async () => {
    const response = await get("from=2026-11-01&to=2026-11-30", "wrong-key-wrong-key-wrong-key-wrong-key");
    expect(response.status).toBe(401);
    expect(mocks.orderFindManyMock).not.toHaveBeenCalled();
  });

  it.each([
    ["", "INVALID_FROM_DATE"],
    ["from=2026-11-01", "INVALID_TO_DATE"],
    ["from=01.11.2026&to=2026-11-30", "INVALID_FROM_DATE"],
    ["from=2026-11-30&to=2026-11-01", "INVALID_DATE_RANGE"],
    ["from=2025-01-01&to=2026-11-30", "DATE_RANGE_TOO_LONG"],
    ["from=2026-11-01&to=2026-11-30&limit=0", "INVALID_LIMIT"],
    ["from=2026-11-01&to=2026-11-30&limit=5000", "INVALID_LIMIT"],
  ])("answers 400 for %s", async (query, reason) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, reason });
    expect(mocks.orderFindManyMock).not.toHaveBeenCalled();
  });

  it("returns the company's orders delivered in the range, oldest first, with the price list names", async () => {
    mocks.orderFindManyMock.mockResolvedValue([order("o1")]);

    const response = await get("from=2026-11-01&to=2026-11-30");

    expect(response.status).toBe(200);
    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: COMPANY_ID, deliveryDate: { gte: "2026-11-01", lte: "2026-11-30" } },
        orderBy: [{ deliveryDate: "asc" }, { id: "asc" }],
        take: 501,
      }),
    );
    expect(mocks.priceListFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["pl-1"] } } }));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.nextCursor).toBeNull();
    expect(body.orders).toEqual([
      expect.objectContaining({
        id: "o1",
        store: { id: "m-creator", name: "POWER Rud" },
        priceList: { id: "pl-1", name: "Hvitevarer prisliste" },
        priceExVatCents: 100000,
        partnerPriceCents: 60000,
      }),
    ]);
  });

  it("pages with a cursor: one row more than the limit means there is a next page", async () => {
    mocks.orderFindManyMock.mockResolvedValue([order("o1"), order("o2"), order("o3")]);

    const response = await get("from=2026-11-01&to=2026-11-30&limit=2&cursor=o0");

    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ take: 3, cursor: { id: "o0" }, skip: 1 }));
    const body = await response.json();
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["o1", "o2"]);
    expect(body.nextCursor).toBe("o2");
  });

  it("answers 503 when the database fails", async () => {
    mocks.orderFindManyMock.mockRejectedValue(new Error("down"));
    const response = await get("from=2026-11-01&to=2026-11-30");
    expect(response.status).toBe(503);
  });
});
