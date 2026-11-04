import { beforeEach, describe, expect, it, vi } from "vitest";

// Paying at booking (HOMEPAGE_PAYMENT_MODE=stripe), as for white goods
// (lib/orders/bookingPayment.ts): the move is saved unpaid and the customer
// goes straight to Stripe Checkout — only at the total they were shown.

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  orderCreate: vi.fn(),
  orderItemCreateMany: vi.fn(),
  getMovingCatalog: vi.fn(),
  getRouteDistance: vi.fn(),
  createOrderNotification: vi.fn(),
  welcomeWebsiteOrderCustomer: vi.fn(),
  startBookingCheckout: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: mocks.membershipFindUnique },
    order: { create: mocks.orderCreate },
    orderItem: { createMany: mocks.orderItemCreateMany },
  },
}));
vi.mock("@/lib/orders/orderNumber", () => ({ reserveNextManualOrderNumber: vi.fn(async () => 1001) }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderCreatedEvent: vi.fn(), buildOrderEventSnapshot: vi.fn(() => ({})) }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/customerAccounts/welcomeWebsiteOrderCustomer", () => ({
  welcomeWebsiteOrderCustomer: mocks.welcomeWebsiteOrderCustomer,
}));
vi.mock("@/lib/orders/bookingCheckout", () => ({ startBookingCheckout: mocks.startBookingCheckout }));
vi.mock("@/lib/integrations/mapbox/routeDistance", () => ({ getRouteDistance: mocks.getRouteDistance }));
vi.mock("@/lib/content/getMovingCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content/getMovingCatalog")>("@/lib/content/getMovingCatalog");
  return { ...actual, getMovingCatalog: mocks.getMovingCatalog };
});

import { priceMovingOrder } from "@/lib/orders/movingOrderQuote";
import { parseMovingProperty } from "@/lib/orders/movingProperty";

const opt = (code: string, labelEn: string, customerPriceCents: number, subcontractorPriceCents = 0) => ({
  code,
  labelEn,
  labelNo: labelEn,
  customerPriceCents,
  subcontractorPriceCents,
});

const catalog = {
  priceListId: "pl-moving",
  options: [opt("SIZE_UNDER_40", "Under 40 m²", 500000, 300000)],
  services: [opt("SERVICE_FLYTTEVASK", "Move-out cleaning", 480000, 250000)],
  floorSurcharge: null,
  carrySurcharges: [],
  distanceRates: { kmFrom21: opt("KM_FROM_21", "Per km", 2890, 1651), kmOver100: opt("KM_OVER_100", "Per km", 2890, 1651) },
};

const origin = { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" };
const destination = { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, parking: "OUTSIDE" };

// What the flow shows (it prices with the same catalog and Mapbox distance).
function serverTotalIncVat(): number {
  const parsedOrigin = parseMovingProperty(origin);
  const parsedDestination = parseMovingProperty(destination);
  if (!parsedOrigin.ok || !parsedDestination.ok) throw new Error("bad fixture");
  const quote = priceMovingOrder(catalog as never, {
    origin: parsedOrigin.property,
    destination: parsedDestination.property,
    serviceCodes: ["SERVICE_FLYTTEVASK"],
    drivingDistance: "42.86",
  });
  if (!quote.ok) throw new Error("bad fixture");
  return quote.pricing.pricingSnapshot.customer.totalIncVat;
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    name: "Kari Nordmann",
    phone: "+47 123 45 678",
    email: "kari@example.com",
    pickupAddress: "Karl Johans gate 1, 0154 Oslo",
    deliveryAddress: "Bragernes torg 1, 3017 Drammen",
    preferredDate: "2026-10-22",
    timeWindow: "10:00-16:00",
    customerType: "private",
    // Cleaning is a service: asked for within the withdrawal period.
    withdrawalConsent: true,
    origin,
    destination,
    serviceCodes: ["SERVICE_FLYTTEVASK"],
    shownTotal: serverTotalIncVat(),
    ...overrides,
  };
}

async function post(payload: unknown) {
  vi.resetModules();
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/site/moving-request", { method: "POST", body: JSON.stringify(payload) }));
}

describe("POST /api/site/moving-request — paying at booking (Stripe)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBSITE_MEMBERSHIP_ID = "m-website";
    process.env.HOMEPAGE_PAYMENT_MODE = "stripe";
    mocks.membershipFindUnique.mockResolvedValue({ id: "m-website", companyId: "c1", status: "ACTIVE" });
    mocks.orderCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "o1", ...data }));
    mocks.getRouteDistance.mockResolvedValue({ distanceKm: "42.86", stopAddresses: [] });
    mocks.getMovingCatalog.mockResolvedValue(catalog);
    mocks.startBookingCheckout.mockResolvedValue({ ok: true, url: "https://checkout.stripe.com/cs_1" });
  });

  it("saves the move unpaid with a payment link token, and sends the customer to Stripe Checkout", async () => {
    const res = await post(body());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, orderNumber: "1001", checkoutUrl: "https://checkout.stripe.com/cs_1" });
    const data = mocks.orderCreate.mock.calls[0]![0].data;
    expect(data.status).toBe("processing");
    expect(data.paymentStatus).toBe("pending");
    expect(data.actionToken).toMatch(/^[a-f0-9]{32}$/);
    expect(mocks.startBookingCheckout).toHaveBeenCalledWith(expect.objectContaining({ id: "o1", actionToken: data.actionToken }));
    // Staff and the customer hear about it once it's paid (Stripe webhook).
    expect(mocks.createOrderNotification).not.toHaveBeenCalled();
    expect(mocks.welcomeWebsiteOrderCustomer).not.toHaveBeenCalled();
  });

  it("requires the total the customer was shown", async () => {
    const res = await post(body({ shownTotal: undefined }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "SHOWN_TOTAL_REQUIRED" });
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it("refuses the move when the shown total isn't what the server calculates, and says the real price", async () => {
    const total = serverTotalIncVat();
    const res = await post(body({ shownTotal: total + 500 }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "PRICE_CHANGED", total });
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it("says so when the payment couldn't be started (the order was cancelled)", async () => {
    mocks.startBookingCheckout.mockResolvedValue({ ok: false });

    const res = await post(body());

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, reason: "PAYMENT_START_FAILED" });
  });

  it("in manual mode: no payment status or checkout, welcome right away, and the shown total is only checked when sent", async () => {
    process.env.HOMEPAGE_PAYMENT_MODE = "manual";

    const res = await post(body({ shownTotal: undefined }));

    expect(res.status).toBe(200);
    expect((await res.json()).checkoutUrl).toBeUndefined();
    expect(mocks.orderCreate.mock.calls[0]![0].data.paymentStatus).toBeUndefined();
    expect(mocks.startBookingCheckout).not.toHaveBeenCalled();
    expect(mocks.welcomeWebsiteOrderCustomer).toHaveBeenCalled();

    const wrong = await post(body({ shownTotal: 1 }));
    expect(wrong.status).toBe(409);
  });
});
