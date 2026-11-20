import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ orderFindUniqueMock: vi.fn(), priceListFindUniqueMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findUnique: mocks.orderFindUniqueMock },
    priceList: { findUnique: mocks.priceListFindUniqueMock },
  },
}));

import { GET } from "./route";

const API_KEY = "accounting-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const saved = { ...process.env };

function get(displayId: string, key = API_KEY) {
  return GET(
    new Request(`http://localhost/api/integrations/accounting/orders/${displayId}`, {
      headers: { Authorization: `Bearer ${key}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
    { params: Promise.resolve({ displayId }) },
  );
}

const order = {
  id: "o1",
  displayId: 20614,
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
  customerName: "Kari Nordmann",
  orderNumber: "POW-55120",
};

describe("GET /api/integrations/accounting/orders/[displayId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ACCOUNTING_API_KEY = API_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
    mocks.priceListFindUniqueMock.mockResolvedValue({ name: "Hvitevarer prisliste" });
  });

  afterAll(() => {
    process.env = { ...saved };
  });

  it("rejects a wrong key", async () => {
    const response = await get("20614", "wrong-key-wrong-key-wrong-key-wrong-key");
    expect(response.status).toBe(401);
    expect(mocks.orderFindUniqueMock).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-3", "1.5", "99999999999999999999"])("answers 400 for booking number %s", async (displayId) => {
    const response = await get(displayId);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, reason: "INVALID_BOOKING_NUMBER" });
  });

  it("returns the order's accounting row with the customer name and the store's reference, in the company only", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue(order);

    const response = await get("20614");

    expect(response.status).toBe(200);
    expect(mocks.orderFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId_displayId: { companyId: COMPANY_ID, displayId: 20614 } } }),
    );
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      order: expect.objectContaining({
        displayId: 20614,
        store: { id: "m-creator", name: "POWER Rud" },
        partner: { id: "m-partner", name: "NORDLINE AS" },
        priceList: { id: "pl-1", name: "Hvitevarer prisliste" },
        priceExVatCents: 100000,
        partnerPriceCents: 60000,
        customerName: "Kari Nordmann",
        storeReference: "POW-55120",
      }),
    });
    expect(body.order).not.toHaveProperty("phone");
  });

  it("answers 404 for an unknown booking number", async () => {
    mocks.orderFindUniqueMock.mockResolvedValue(null);
    const response = await get("123");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, reason: "ORDER_NOT_FOUND" });
  });

  it("answers 503 when the database fails", async () => {
    mocks.orderFindUniqueMock.mockRejectedValue(new Error("down"));
    expect((await get("123")).status).toBe(503);
  });
});
