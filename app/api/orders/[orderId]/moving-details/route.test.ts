import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSession: vi.fn(),
  membershipFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn((arg) => ({ op: "order.update", arg })),
  itemDeleteMany: vi.fn((arg) => ({ op: "items.deleteMany", arg })),
  itemCreateMany: vi.fn((arg) => ({ op: "items.createMany", arg })),
  transaction: vi.fn(),
  getMovingCatalog: vi.fn(),
  getRouteDistance: vi.fn(),
  createOrderUpdatedEvent: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSession: mocks.getAuthenticatedSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirst },
    order: { findFirst: mocks.orderFindFirst, update: mocks.orderUpdate },
    orderItem: { deleteMany: mocks.itemDeleteMany, createMany: mocks.itemCreateMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/integrations/mapbox/routeDistance", () => ({ getRouteDistance: mocks.getRouteDistance }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderUpdatedEvent: mocks.createOrderUpdatedEvent }));
vi.mock("@/lib/content/getMovingCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content/getMovingCatalog")>("@/lib/content/getMovingCatalog");
  return { ...actual, getMovingCatalog: mocks.getMovingCatalog };
});

import { PUT } from "./route";

const opt = (code: string, labelEn: string, customerPriceCents: number, subcontractorPriceCents = 0) => ({
  code,
  labelEn,
  labelNo: labelEn,
  customerPriceCents,
  subcontractorPriceCents,
});

const apartment = { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" };
const house = { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" };

function storedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    companyId: "c1",
    status: "processing",
    websiteOrderKind: "MOVING",
    websiteBookingDetails: { version: 1, customerType: "private", origin: apartment, destination: house, serviceCodes: [] },
    pickupAddress: "Karl Johans gate 1, Oslo",
    deliveryAddress: "Storgata 1, Oslo",
    extraPickupAddress: [],
    drivingDistance: "3",
    deliveryDate: "2026-10-22",
    timeWindow: "10:00-16:00",
    customerName: "Kari",
    phone: "+47 12345678",
    email: "kari@example.com",
    customerComments: null,
    description: "Moving from: …",
    driver: null,
    secondDriver: null,
    driverInfo: null,
    licensePlate: null,
    deviation: null,
    expressDelivery: false,
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    priceExVat: 5000,
    priceSubcontractor: 3000,
    pricingSnapshot: { customer: { totalExVat: 5000, totalIncVat: 6250 }, lines: [] },
    productsSummary: "Moving (Under 40 m²)",
    payments: [],
    ...overrides,
  };
}

function put(body: unknown) {
  return PUT(new Request("http://localhost/api/orders/o1/moving-details", { method: "PUT", body: JSON.stringify(body) }), {
    params: Promise.resolve({ orderId: "o1" }),
  });
}

const edit = { pickupAddress: "Karl Johans gate 1, Oslo", deliveryAddress: "Storgata 1, Oslo", origin: apartment, destination: house, serviceCodes: [] };

describe("PUT /api/orders/[orderId]/moving-details (admin edit of a homepage move)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSession.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirst.mockResolvedValue({ id: "m1", role: "OWNER", appAccess: [], user: { username: "admin", email: "a@x" } });
    mocks.orderFindFirst.mockResolvedValue(storedOrder());
    mocks.transaction.mockResolvedValue([]);
    mocks.getRouteDistance.mockResolvedValue({ distanceKm: "42.86", stopAddresses: [] });
    mocks.getMovingCatalog.mockResolvedValue({
      priceListId: "pl",
      options: [opt("SIZE_UNDER_40", "Under 40 m²", 500000, 300000)],
      services: [opt("SERVICE_FLYTTEVASK", "Move-out cleaning", 480000, 250000)],
      floorSurcharge: null,
      carrySurcharges: [],
      distanceRates: { kmFrom21: opt("KM_FROM_21", "Per km", 2890, 1651), kmOver100: opt("KM_OVER_100", "Per km", 2890, 1651) },
    });
  });

  it("is for admins only", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ id: "m1", role: "USER", appAccess: [] });
    expect((await put({ edit })).status).toBe(403);
  });

  it("only edits homepage moves", async () => {
    mocks.orderFindFirst.mockResolvedValue(storedOrder({ websiteOrderKind: "WHITE_GOODS" }));
    expect((await put({ edit })).status).toBe(404);
  });

  it("refuses to change a finished order", async () => {
    mocks.orderFindFirst.mockResolvedValue(storedOrder({ status: "completed" }));
    expect((await put({ edit })).status).toBe(409);
  });

  it("re-prices an edited move from the catalog, re-checking the distance when an address moved", async () => {
    const res = await put({ edit: { ...edit, deliveryAddress: "Bragernes torg 1, Drammen", serviceCodes: ["SERVICE_FLYTTEVASK"] } });
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(mocks.getRouteDistance).toHaveBeenCalledWith({ pickupAddress: edit.pickupAddress, deliveryAddress: "Bragernes torg 1, Drammen" });
    expect(json.priceExVat).toBe(5000 + 4800 + Math.round((2890 * 43) / 100));

    const ops = mocks.transaction.mock.calls[0][0];
    expect(ops.map((op: { op: string }) => op.op)).toEqual(["items.deleteMany", "items.createMany", "order.update"]);
    const data = mocks.orderUpdate.mock.calls[0][0].data;
    expect(data.deliveryAddress).toBe("Bragernes torg 1, Drammen");
    expect(data.drivingDistance).toBe("42.86");
    expect(data.websiteBookingDetails.serviceCodes).toEqual(["SERVICE_FLYTTEVASK"]);
    expect(data.websiteBookingDetails.customerType).toBe("private");
  });

  it("keeps the stored distance when no address moved", async () => {
    await put({ edit: { ...edit, serviceCodes: ["SERVICE_FLYTTEVASK"] } });
    expect(mocks.getRouteDistance).not.toHaveBeenCalled();
    expect(mocks.orderUpdate.mock.calls[0][0].data.drivingDistance).toBe("3");
  });

  it("previews without saving (dryRun), with the paid-vs-now comparison", async () => {
    const json = await (await put({ edit: { ...edit, serviceCodes: ["SERVICE_FLYTTEVASK"] }, dryRun: true })).json();
    expect(json).toMatchObject({ ok: true, dryRun: true, previousPriceExVat: 5000, priceExVat: 9800 });
    expect(json.comparison.currentTotalIncVatNok).toBe(6250 + 6000);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid move", async () => {
    const res = await put({ edit: { ...edit, origin: { ...apartment, sizeOptionCode: "NOPE" } } });
    expect(res.status).toBe(422);
  });

  it("saves the handling panel's fields that don't change a move's price — never express or the deviation", async () => {
    const res = await put({ handling: { driver: "Ola", licensePlate: "EL12345", expressDelivery: true, deviation: "Wrong address", deliveryDate: "2026-10-23" } });
    expect((await res.json()).ok).toBe(true);
    const data = mocks.orderUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({ driver: "Ola", licensePlate: "EL12345", deliveryDate: "2026-10-23" });
    expect(data).not.toHaveProperty("expressDelivery");
    expect(data).not.toHaveProperty("deviation");
    expect(mocks.getMovingCatalog).not.toHaveBeenCalled();
  });

  it("saves the contact details and schedule with an edit", async () => {
    await put({ edit, customer: { name: "Kari N", phone: "+47 87654321", email: "kari@example.com", comments: "Piano" }, preferredDate: "2026-10-25", timeWindow: "16:00-21:00" });
    const data = mocks.orderUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({ customerName: "Kari N", phone: "+47 87654321", customerComments: "Piano", deliveryDate: "2026-10-25", timeWindow: "16:00-21:00" });
    expect(data.description).toContain("Piano");
  });
});
