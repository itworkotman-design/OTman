import { beforeEach, describe, expect, it, vi } from "vitest";

// What a successful booking stores — the whole creation chain mocked, unlike
// route.test.ts (validation, rate limits, price resolution).

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  orderCreate: vi.fn(),
  orderItemCreateMany: vi.fn(),
  getMovingCatalog: vi.fn(),
  getRouteDistance: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: mocks.membershipFindUnique },
    order: { create: mocks.orderCreate },
    orderItem: { createMany: mocks.orderItemCreateMany },
  },
}));
vi.mock("@/lib/orders/orderNumber", () => ({ reserveNextManualOrderNumber: vi.fn(async () => 1001) }));
vi.mock("@/lib/orders/publicOrderNumber", () => ({ reservePublicOrderNumber: vi.fn(async () => "123456") }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderCreatedEvent: vi.fn(), buildOrderEventSnapshot: vi.fn(() => ({})) }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: vi.fn() }));
vi.mock("@/lib/customerAccounts/welcomeWebsiteOrderCustomer", () => ({ welcomeWebsiteOrderCustomer: vi.fn() }));
vi.mock("@/lib/integrations/mapbox/routeDistance", () => ({ getRouteDistance: mocks.getRouteDistance }));
vi.mock("@/lib/content/getMovingCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content/getMovingCatalog")>("@/lib/content/getMovingCatalog");
  return { ...actual, getMovingCatalog: mocks.getMovingCatalog };
});

const opt = (code: string, labelEn: string, customerPriceCents: number, subcontractorPriceCents = 0) => ({
  code,
  labelEn,
  labelNo: labelEn,
  customerPriceCents,
  subcontractorPriceCents,
});

const body = {
  name: "Kari Nordmann",
  phone: "+47 123 45 678",
  email: "kari@example.com",
  pickupAddress: "Karl Johans gate 1, 0154 Oslo",
  deliveryAddress: "Bragernes torg 1, 3017 Drammen",
  preferredDate: "2026-10-22",
  timeWindow: "10:00-16:00",
  customerType: "business",
  origin: { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" },
  destination: { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, parking: "OUTSIDE" },
  serviceCodes: ["SERVICE_FLYTTEVASK"],
};

describe("POST /api/site/moving-request — what's stored", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.WEBSITE_MEMBERSHIP_ID = "m-website";
    mocks.membershipFindUnique.mockResolvedValue({ id: "m-website", companyId: "c1", status: "ACTIVE" });
    mocks.orderCreate.mockImplementation(async ({ data }) => ({ id: "o1", ...data }));
    mocks.getRouteDistance.mockResolvedValue({ distanceKm: "42.86", stopAddresses: [] });
    mocks.getMovingCatalog.mockResolvedValue({
      priceListId: "pl-moving",
      options: [opt("SIZE_UNDER_40", "Under 40 m²", 500000, 300000)],
      services: [opt("SERVICE_FLYTTEVASK", "Move-out cleaning", 480000, 250000)],
      floorSurcharge: null,
      carrySurcharges: [],
      distanceRates: { kmFrom21: opt("KM_FROM_21", "Per km", 2890, 1651), kmOver100: opt("KM_OVER_100", "Per km", 2890, 1651) },
    });
  });

  async function post() {
    const { POST } = await import("./route");
    return POST(new Request("http://localhost/api/site/moving-request", { method: "POST", body: JSON.stringify(body) }));
  }

  it("saves a MOVING website order with the customer's answers, so the admin modal can show and edit them", async () => {
    const res = await post();
    expect(res.status).toBe(200);

    const { data } = mocks.orderCreate.mock.calls[0][0];
    expect(data.isWebsiteOrder).toBe(true);
    expect(data.websiteOrderKind).toBe("MOVING");
    expect(data.websiteBookingDetails).toEqual({
      version: 1,
      customerType: "business",
      origin: { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" },
      destination: { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" },
      serviceCodes: ["SERVICE_FLYTTEVASK"],
    });
    expect(data.drivingDistance).toBe("42.86");
    expect(data.priceExVat).toBe(5000 + 4800 + Math.round((2890 * 43) / 100));
    expect(data.priceSubcontractor).toBe(3000 + 2500 + Math.round((1651 * 43) / 100));
  });

  it("stores one order line per priced line", async () => {
    await post();
    const { data: rows } = mocks.orderItemCreateMany.mock.calls[0][0];
    expect(rows.map((r: { orderId: string; optionCode: string; quantity: number }) => [r.orderId, r.optionCode, r.quantity])).toEqual([
      ["o1", "SIZE_UNDER_40", 1],
      ["o1", "SERVICE_FLYTTEVASK", 1],
      ["o1", "KM_FROM_21", 43],
    ]);
  });
});
