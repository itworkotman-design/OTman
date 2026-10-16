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
const sizeItem = {
  cardId: 0,
  productCode: "MOVING_BY_SIZE",
  productName: "Moving",
  itemType: "product",
  optionCode: "SIZE_UNDER_40",
  optionLabel: "Under 40 m²",
  quantity: 1,
  customerPriceCents: 500000,
  subcontractorPriceCents: 300000,
};

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
    items: [sizeItem],
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
      handlingRates: {
        expressDelivery: opt("EXPRESS_DELIVERY", "Express delivery", 150000, 80000),
        deviations: [opt("WRONGADRESS", "Avvik, bomtur; Feil adresse", 59000, 14900), opt("CUSTOM", "Custom", 0, 0)],
      },
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

  it("saves the handling panel's fields that don't change a move's price, without re-pricing", async () => {
    const res = await put({ handling: { driver: "Ola", licensePlate: "EL12345", expressDelivery: false, deviation: "", deliveryDate: "2026-10-23" } });
    expect((await res.json()).ok).toBe(true);
    const data = mocks.orderUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({ driver: "Ola", licensePlate: "EL12345", deliveryDate: "2026-10-23" });
    expect(mocks.getMovingCatalog).not.toHaveBeenCalled();
    // Nothing that changes the price was sent, so it isn't re-priced.
    expect(data).not.toHaveProperty("priceExVat");
    expect(data).not.toHaveProperty("rabatt");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  describe("express and the deviation (priced from the moving price list's settings, like a delivery's)", () => {
    const createdRows = () => mocks.itemCreateMany.mock.calls[0][0].data as Record<string, unknown>[];

    it("adds express as an order-extra line and re-prices the move", async () => {
      const res = await put({ handling: { expressDelivery: true } });
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.priceExVat).toBe(5000 + 1500);
      expect(mocks.transaction).toHaveBeenCalled();
      expect(createdRows()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ productCode: "MOVING_BY_SIZE" }),
          expect.objectContaining({ productCode: "MOVING_EXPRESS", optionCode: "EXPRESS_DELIVERY", customerPriceCents: 150000, subcontractorPriceCents: 80000, orderId: "o1" }),
        ]),
      );
      const data = mocks.orderUpdate.mock.calls[0][0].data;
      expect(data).toMatchObject({ expressDelivery: true, priceExVat: 6500, priceSubcontractor: 3000 + 800 });
    });

    it("adds a deviation at its price list price", async () => {
      const res = await put({ handling: { deviation: "Avvik, bomtur; Feil adresse" } });
      expect((await res.json()).priceExVat).toBe(5000 + 590);
      expect(createdRows()).toEqual(
        expect.arrayContaining([expect.objectContaining({ productCode: "MOVING_DEVIATION", optionCode: "WRONGADRESS", customerPriceCents: 59000 })]),
      );
      expect(mocks.orderUpdate.mock.calls[0][0].data).toMatchObject({ deviation: "Avvik, bomtur; Feil adresse" });
    });

    it("prices a custom deviation with its own prices and description", async () => {
      const res = await put({ handling: { deviation: "Custom", customDeviation: { price: 750, subcontractorPrice: 300, description: "Piano" } } });
      expect((await res.json()).priceExVat).toBe(5000 + 750);
      expect(createdRows()).toEqual(
        expect.arrayContaining([expect.objectContaining({ productCode: "MOVING_DEVIATION", optionLabel: "Piano", customerPriceCents: 75000, subcontractorPriceCents: 30000 })]),
      );
    });

    it("removes the express line when express is turned off", async () => {
      const expressItem = { ...sizeItem, productCode: "MOVING_EXPRESS", productName: "Express delivery", optionCode: "EXPRESS_DELIVERY", optionLabel: "Express delivery", customerPriceCents: 150000, subcontractorPriceCents: 80000 };
      mocks.orderFindFirst.mockResolvedValue(storedOrder({ expressDelivery: true, items: [sizeItem, expressItem], priceExVat: 6500 }));
      const json = await (await put({ handling: { expressDelivery: false } })).json();
      expect(json.priceExVat).toBe(5000);
      expect(createdRows().some((row) => row.productCode === "MOVING_EXPRESS")).toBe(false);
    });

    it("keeps the stored express line, as priced, when an edit re-prices the move", async () => {
      const expressItem = { ...sizeItem, productCode: "MOVING_EXPRESS", productName: "Express delivery", optionCode: "EXPRESS_DELIVERY", optionLabel: "Express delivery", customerPriceCents: 120000, subcontractorPriceCents: 60000 };
      mocks.orderFindFirst.mockResolvedValue(storedOrder({ expressDelivery: true, items: [sizeItem, expressItem], priceExVat: 6200 }));
      const json = await (await put({ edit: { ...edit, serviceCodes: ["SERVICE_FLYTTEVASK"] } })).json();
      expect(json.priceExVat).toBe(5000 + 4800 + 1200);
      expect(createdRows()).toEqual(expect.arrayContaining([expect.objectContaining({ productCode: "MOVING_EXPRESS", customerPriceCents: 120000 })]));
    });

    it("previews the change (dryRun) with the calculator showing the new line", async () => {
      const json = await (await put({ handling: { expressDelivery: true }, dryRun: true })).json();
      expect(json.priceExVat).toBe(6500);
      const extras = json.calculator.products.find((product: { isOrderExtras: boolean }) => product.isOrderExtras);
      expect(extras.lines).toEqual([expect.objectContaining({ label: "Express delivery", customer: 1500 })]);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.orderUpdate).not.toHaveBeenCalled();
    });

    it("rejects an unknown deviation", async () => {
      expect((await put({ handling: { deviation: "Wrong address" } })).status).toBe(422);
    });
  });

  it("saves the contact details and schedule with an edit", async () => {
    await put({ edit, customer: { name: "Kari N", phone: "+47 87654321", email: "kari@example.com", comments: "Piano" }, preferredDate: "2026-10-25", timeWindow: "16:00-21:00" });
    const data = mocks.orderUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({ customerName: "Kari N", phone: "+47 87654321", customerComments: "Piano", deliveryDate: "2026-10-25", timeWindow: "16:00-21:00" });
    expect(data.description).toContain("Piano");
  });

  it("stores the calculator's discount, extra and partner minus/plus, re-pricing the stored lines with them", async () => {
    const res = await put({
      handling: { rabatt: "500", leggTil: "100", subcontractorMinus: "300", subcontractorPlus: "50" },
      nulledLines: { cards: {}, orderExtras: { customer: [], subcontractor: [] } },
    });
    expect((await res.json()).ok).toBe(true);
    const data = mocks.orderUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({ rabatt: "500", leggTil: "100", subcontractorMinus: "300", subcontractorPlus: "50" });
    expect(data.priceExVat).toBe(5000 - 500 + 100);
    expect(data.priceSubcontractor).toBe(3000 - 300 + 50);
    expect(data.pricingSnapshot.customer).toMatchObject({ discount: 500, extra: 100, totalExVat: 4600, totalIncVat: 6250 - 625 + 125 });
    expect(mocks.getMovingCatalog).not.toHaveBeenCalled();
  });

  it("keeps the stored discount when an edit re-prices the move", async () => {
    mocks.orderFindFirst.mockResolvedValue(storedOrder({ rabatt: "500", subcontractorMinus: "300" }));
    const json = await (await put({ edit: { ...edit, serviceCodes: ["SERVICE_FLYTTEVASK"] } })).json();
    expect(json.priceExVat).toBe(9800 - 500);
    expect(mocks.orderUpdate.mock.calls[0][0].data.priceSubcontractor).toBe(5500 - 300);
  });

  it("previews the calculator (dryRun) — the same view the Overview shows", async () => {
    const json = await (await put({ handling: { rabatt: "500" }, dryRun: true })).json();
    expect(json.calculator.customer).toMatchObject({ subtotal: 5000, discount: 500, total: 4500 });
    expect(json.calculator.partner).toEqual({ base: 3000, minus: 0, plus: 0, total: 3000 });
    expect(json.calculator.products[0].lines[0]).toMatchObject({ code: "SIZE_UNDER_40", customer: 5000, partner: 3000 });
    expect(json.comparison.currentTotalIncVatNok).toBe(6250 - 625);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it("previews an edit with the calculator re-priced from the catalog", async () => {
    const json = await (await put({ edit: { ...edit, serviceCodes: ["SERVICE_FLYTTEVASK"] }, dryRun: true })).json();
    expect(json.calculator.customer.total).toBe(9800);
    expect(json.calculator.products[0].lines.map((l: { code: string }) => l.code)).toEqual(["SIZE_UNDER_40", "SERVICE_FLYTTEVASK"]);
  });

  it("stores the calculator's lines set to 0 and re-prices without them", async () => {
    const key = "MOVING_BY_SIZE:SIZE_UNDER_40";
    await put({ handling: {}, nulledLines: { cards: { 0: { customer: [key], subcontractor: [] } }, orderExtras: { customer: [], subcontractor: [] } } });
    const data = mocks.orderUpdate.mock.calls[0][0].data;
    expect(data.priceExVat).toBe(0);
    expect(data.priceSubcontractor).toBe(3000);
    expect(data.pricingSnapshot.movingNulledLines).toEqual({ customer: [key], subcontractor: [] });
  });

  it("keeps the lines set to 0 when an edit re-prices the move", async () => {
    const key = "MOVING_BY_SIZE:SIZE_UNDER_40";
    mocks.orderFindFirst.mockResolvedValue(storedOrder({ pricingSnapshot: { customer: { totalExVat: 0, totalIncVat: 0 }, lines: [], movingNulledLines: { customer: [key], subcontractor: [] } } }));
    const json = await (await put({ edit: { ...edit, serviceCodes: ["SERVICE_FLYTTEVASK"] } })).json();
    expect(json.priceExVat).toBe(4800);
  });

  describe("\"Use new price\"", () => {
    // Saved before the size went from 4 000 to 5 000 kr.
    const outdated = () => storedOrder({ items: [{ ...sizeItem, customerPriceCents: 400000 }], priceExVat: 4000 });

    it("re-prices the move's own answers at today's catalog", async () => {
      mocks.orderFindFirst.mockResolvedValue(outdated());
      const json = await (await put({ handling: {}, useCurrentPrices: true })).json();
      expect(json).toMatchObject({ ok: true, previousPriceExVat: 4000, priceExVat: 5000 });
      const ops = mocks.transaction.mock.calls[0][0];
      expect(ops.map((op: { op: string }) => op.op)).toEqual(["items.deleteMany", "items.createMany", "order.update"]);
    });

    it("refuses an edit of a move saved at older prices until it's chosen, like a delivery", async () => {
      mocks.orderFindFirst.mockResolvedValue(outdated());
      const refused = await put({ edit: { ...edit, serviceCodes: ["SERVICE_FLYTTEVASK"] }, dryRun: true });
      expect(refused.status).toBe(409);
      expect((await refused.json()).reason).toBe("PRICES_OUTDATED");
      const json = await (await put({ edit: { ...edit, serviceCodes: ["SERVICE_FLYTTEVASK"] }, useCurrentPrices: true, dryRun: true })).json();
      expect(json).toMatchObject({ ok: true, priceExVat: 9800 });
    });

    it("still lets the amounts change on the stored lines without it", async () => {
      mocks.orderFindFirst.mockResolvedValue(outdated());
      const json = await (await put({ handling: { rabatt: "100" } })).json();
      expect(json.priceExVat).toBe(3900);
    });
  });

  it("saves the customer type, without re-pricing the move", async () => {
    await put({ customerType: "business" });
    const data = mocks.orderUpdate.mock.calls[0][0].data;
    expect(data.websiteBookingDetails).toMatchObject({ customerType: "business", origin: apartment, destination: house });
    expect(data).not.toHaveProperty("priceExVat");
    expect(mocks.getMovingCatalog).not.toHaveBeenCalled();
  });

  it("keeps a new customer type on an edited move", async () => {
    await put({ edit: { ...edit, serviceCodes: ["SERVICE_FLYTTEVASK"] }, customerType: "business" });
    expect(mocks.orderUpdate.mock.calls[0][0].data.websiteBookingDetails.customerType).toBe("business");
  });

  it("rejects an unknown customer type", async () => {
    expect((await put({ customerType: "vip" })).status).toBe(422);
  });

  it("rejects an amount that isn't kroner", async () => {
    expect((await put({ handling: { rabatt: "abc" } })).status).toBe(422);
  });
});
