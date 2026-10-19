import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSession: vi.fn(),
  membershipFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
  getWebsiteOrderCatalog: vi.fn(),
  recompute: vi.fn(),
  resolvePricing: vi.fn(),
  getMovingCatalog: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSession: mocks.getAuthenticatedSession }));
vi.mock("@/lib/db", () => ({
  prisma: { membership: { findFirst: mocks.membershipFindFirst }, order: { findFirst: mocks.orderFindFirst } },
}));
vi.mock("@/lib/content/websiteOrderCatalog", () => ({ getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalog }));
vi.mock("@/lib/orders/websiteOrderRepricing", () => ({
  recomputeWebsiteOrderPricing: mocks.recompute,
  resolveSavedCatalogPricing: mocks.resolvePricing,
}));
vi.mock("@/lib/content/getMovingCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content/getMovingCatalog")>("@/lib/content/getMovingCatalog");
  return { ...actual, getMovingCatalog: mocks.getMovingCatalog };
});

import { GET } from "./route";

const call = () =>
  GET(new Request("http://localhost/api/orders/o1/partner-view"), { params: Promise.resolve({ orderId: "o1" }) });

const whiteGoods = {
  id: "o1",
  displayId: 42,
  orderNumber: "583920",
  status: "active",
  createdAt: new Date("2026-10-01T10:00:00Z"),
  customerName: "Kari",
  phone: "87654321",
  email: "kari@example.no",
  customerComments: null,
  description: "Intern beskrivelse",
  driverInfo: "Ring først",
  priceExVat: 1241,
  priceSubcontractor: 460,
  rabatt: null,
  leggTil: null,
  subcontractorMinus: null,
  subcontractorPlus: null,
  subcontractorMembershipId: "m-partner",
  createdByMembershipId: "m-website",
  customerMembershipId: "m-website",
  websiteOrderKind: "WHITE_GOODS",
  websiteBookingDetails: {
    version: 1,
    customerType: "private",
    pickups: [{ source: "store", placeName: "Power", address: "Strømmen 1", floor: null, liftAvailable: false, contactName: "", contactPhone: "" }],
    delivery: { address: "Kirkegata 5", floor: 3, liftAvailable: false },
    preferredDate: "2026-10-10",
    timeWindow: "08:00-16:00",
    drivingDistance: "21",
    orderExtras: [],
  },
  pickupAddress: "Strømmen 1",
  deliveryAddress: "Kirkegata 5",
  extraPickupAddress: [],
  deliveryDate: "2026-10-10",
  timeWindow: "08:00-16:00",
  drivingDistance: "21",
  pricingSnapshot: { customer: { totalExVat: 1241, totalIncVat: 1551 }, lines: [] },
  productCardsSnapshot: [],
  items: [],
};

const calculatorResult = {
  pricingResult: {
    breakdowns: [
      { productName: "Vaskemaskin", cardId: 0, lines: [{ label: "Levering", qty: 1, unitPrice: 899, lineTotal: 899, subcontractorLineTotal: 400 }] },
      { productName: "Tillegg", isOrderExtras: true, lines: [{ label: "Etasjetillegg", qty: 2, unitPrice: 171, lineTotal: 342, subcontractorLineTotal: 60 }] },
    ],
    totals: {
      subtotalExVat: 1241,
      discount: 0,
      extra: 0,
      checkboxDiscount: 0,
      totalExVat: 1241,
      vat: 0,
      totalIncVat: 1551,
      subcontractorBase: 460,
      subcontractorMinus: 0,
      subcontractorPlus: 0,
      subcontractorCheckboxDiscount: 0,
      subcontractorTotal: 460,
    },
  },
};

describe("GET /api/orders/[orderId]/partner-view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSession.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirst.mockResolvedValue({ id: "m-partner", role: "USER", permissions: [] });
    mocks.orderFindFirst.mockResolvedValue(whiteGoods);
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ products: [] });
    mocks.resolvePricing.mockResolvedValue(null);
    mocks.recompute.mockResolvedValue(calculatorResult);
    mocks.getMovingCatalog.mockResolvedValue({ options: [] });
  });

  it("gives the assigned partner the job and their own price, line by line, totalling what they're paid — no customer prices", async () => {
    const json = await (await call()).json();
    expect(json.ok).toBe(true);
    expect(json.view.role).toBe("partner");
    expect(json.view.kind).toBe("white-goods");
    expect(json.view.details.delivery.address).toBe("Kirkegata 5");
    expect(json.view.partner).toEqual({
      groups: [
        { name: "Vaskemaskin", lines: [{ label: "Levering", qty: 1, price: 400 }] },
        { name: "Tillegg", lines: [{ label: "Etasjetillegg", qty: 2, price: 60 }] },
      ],
      total: 460,
      mismatch: 0,
    });
    expect(json.view.customer).toBeNull();
    expect(JSON.stringify(json.view)).not.toContain("1551");
  });

  it("refuses another partner's order", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ id: "m-other", role: "USER", permissions: [] });
    expect((await call()).status).toBe(404);
  });

  it("shows an admin the customer's side too", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ id: "m-admin", role: "ADMIN", permissions: [] });
    const json = await (await call()).json();
    expect(json.view.customer).toEqual({ totalExVat: 1241, totalIncVat: 1551 });
  });

  it("falls back to the stored total when the order can't be priced, with the lines left out", async () => {
    mocks.recompute.mockRejectedValue(new Error("catalog down"));
    const json = await (await call()).json();
    expect(json.view.partner).toEqual({ groups: [], total: 460, mismatch: 460 });
  });

  it("serves a move from its stored lines", async () => {
    mocks.orderFindFirst.mockResolvedValue({
      ...whiteGoods,
      websiteOrderKind: "MOVING",
      priceSubcontractor: 3000,
      websiteBookingDetails: {
        version: 1,
        customerType: "private",
        origin: { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" },
        destination: { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" },
        serviceCodes: [],
      },
      items: [
        { productCode: "MOVING_BY_SIZE", optionCode: "SIZE_UNDER_40", optionLabel: "Under 40 m²", quantity: 1, customerPriceCents: 500000, subcontractorPriceCents: 300000 },
      ],
    });
    const json = await (await call()).json();
    expect(json.view.kind).toBe("moving");
    expect(json.view.moving.edit.origin.homeType).toBe("APARTMENT");
    expect(json.view.partner).toEqual({ groups: [{ name: "Moving", lines: [{ label: "Under 40 m²", qty: 1, price: 3000 }] }], total: 3000, mismatch: 0 });
    expect(mocks.recompute).not.toHaveBeenCalled();
  });

  const serviceOrder = {
    ...whiteGoods,
    websiteOrderKind: "SERVICE",
    priceExVat: 2500,
    priceSubcontractor: 1800,
    deliveryAddress: "Storgata 1",
    websiteBookingDetails: {
      version: 2,
      customerType: "business",
      services: [{ serviceCode: "option-1", customService: "", jobDescription: "Bytte stikkontakter" }],
    },
    pricingSnapshot: { customer: { totalExVat: 2500, totalIncVat: 3125 }, lines: [] },
    items: [
      { productCode: "SERVICE_QUOTE", optionCode: "QUOTE:option-1", optionLabel: "Electrician", quantity: 1, customerPriceCents: 250000, subcontractorPriceCents: 180000 },
    ],
  };

  it("serves a service request: the job as booked and the partner's quoted price, never the customer's quote", async () => {
    mocks.orderFindFirst.mockResolvedValue(serviceOrder);
    const json = await (await call()).json();
    expect(json.ok).toBe(true);
    expect(json.view.kind).toBe("service");
    expect(json.view.service).toEqual({
      customerType: "business",
      services: [{ serviceCode: "option-1", customService: "", jobDescription: "Bytte stikkontakter" }],
      address: "Storgata 1",
      preferredDate: "2026-10-10",
      timeWindow: "08:00-16:00",
    });
    expect(json.view.partner).toEqual({ groups: [{ name: "Service", lines: [{ label: "Electrician", qty: 1, price: 1800 }] }], total: 1800, mismatch: 0 });
    expect(json.view.customer).toBeNull();
    expect(JSON.stringify(json.view)).not.toContain("2500");
    expect(mocks.recompute).not.toHaveBeenCalled();
  });

  it("serves a service request staff haven't quoted yet, with no lines", async () => {
    mocks.orderFindFirst.mockResolvedValue({ ...serviceOrder, priceExVat: 0, priceSubcontractor: 0, items: [] });
    const json = await (await call()).json();
    expect(json.view.kind).toBe("service");
    expect(json.view.partner).toEqual({ groups: [], total: 0, mismatch: 0 });
  });

  it("isn't for orders that aren't homepage website orders (the old view stays)", async () => {
    mocks.orderFindFirst.mockResolvedValue({ ...whiteGoods, websiteOrderKind: null });
    expect((await (await call()).json()).reason).toBe("NOT_WEBSITE_ORDER");
  });
});
