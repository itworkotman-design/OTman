import { beforeEach, describe, expect, it, vi } from "vitest";

// Paying at booking (HOMEPAGE_PAYMENT_MODE=stripe): the order is saved
// unpaid, the customer goes straight to Stripe Checkout, and staff and the
// customer only hear about it once the payment lands (the Stripe webhook).

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  orderCreate: vi.fn(),
  orderItemCreateMany: vi.fn(),
  getWebsiteOrderCatalog: vi.fn(),
  welcomeWebsiteOrderCustomer: vi.fn(),
  createOrderNotification: vi.fn(),
  startBookingCheckout: vi.fn(),
}));

vi.mock("@/lib/customerAccounts/welcomeWebsiteOrderCustomer", () => ({
  welcomeWebsiteOrderCustomer: mocks.welcomeWebsiteOrderCustomer,
}));
vi.mock("@/lib/orders/bookingCheckout", () => ({ startBookingCheckout: mocks.startBookingCheckout }));
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: mocks.membershipFindUnique },
    order: { create: mocks.orderCreate },
    orderItem: { createMany: mocks.orderItemCreateMany },
  },
}));
vi.mock("@/lib/content/websiteOrderCatalog", () => ({ getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalog }));
vi.mock("@/lib/orders/orderNumber", () => ({ reserveNextManualOrderNumber: vi.fn().mockResolvedValue(20012) }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderCreatedEvent: vi.fn(), buildOrderEventSnapshot: vi.fn() }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
// The km charge comes from the server's own Mapbox lookup, never from the request.
vi.mock("@/lib/integrations/mapbox/routeDistance", () => ({
  getRouteDistance: vi.fn(async () => ({ distanceKm: "20", stopAddresses: [] })),
}));

import { createEmptyProductCard, type CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { normalizePriceListSettings } from "@/lib/products/priceListSettings";
import { priceWebsiteOrder } from "@/lib/booking/pricing/priceWebsiteOrder";

const washer: CatalogProduct = {
  id: "p-wm",
  code: "WG_WASHING_MACHINE",
  label: "Washing machine",
  active: true,
  productType: "PHYSICAL",
  allowDeliveryTypes: true,
  allowInstallOptions: true,
  allowReturnOptions: true,
  allowExtraServices: true,
  allowDemont: false,
  allowQuantity: true,
  allowPeopleCount: false,
  allowHoursInput: false,
  allowModelNumber: false,
  autoXtraPerPallet: false,
  deliveryTypes: [
    {
      key: DELIVERY_TYPES.INDOOR as CatalogProduct["deliveryTypes"][number]["key"],
      enabled: true,
      code: DELIVERY_TYPES.INDOOR,
      label: "Delivery with carry-in",
      price: "690",
      subcontractorPrice: "100",
      xtraPrice: "235",
      xtraSubcontractorPrice: "50",
      allowInstallOptions: true,
      allowExtraServices: true,
      allowReturnOptions: true,
      allowModelNumber: false,
    },
  ],
  customSections: [],
  options: [],
};
const priceListSettings = normalizePriceListSettings(null);
const cards = [{ ...createEmptyProductCard(0), productId: "p-wm", amount: 1, deliveryType: DELIVERY_TYPES.INDOOR }];

function shownTotal() {
  return priceWebsiteOrder({
    cards,
    catalogProducts: [washer],
    catalogSpecialOptions: [],
    priceListSettings,
    drivingDistance: "20",
    expressDelivery: false,
    extraPickups: [],
    pickupFloor: 0,
    deliveryFloor: 0,
    pickupLiftAvailable: true,
    deliveryLiftAvailable: false,
    extraPickupFloors: [],
  }).customerTotals.totalIncVat;
}

function body() {
  return {
    productCards: cards,
    pickupSource: "private",
    pickupContactName: "Ola",
    pickupContactPhone: "93004023",
    pickupAddress: "Smalvollveien 65, Oslo",
    deliveryAddress: "Otto Blehrs vei 25c, Nesøya",
    drivingDistance: "20",
    name: "Ralfs",
    phone: "93004023",
    email: "customer@example.com",
    preferredDate: "2030-01-08",
    timeWindow: "10:00-16:00",
    shownTotal: shownTotal(),
  };
}

async function post() {
  vi.resetModules();
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/site/white-goods-order", { method: "POST", body: JSON.stringify(body()) }));
}

describe("POST /api/site/white-goods-order — paying at booking (Stripe)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBSITE_MEMBERSHIP_ID = "m-web";
    process.env.HOMEPAGE_PAYMENT_MODE = "stripe";
    mocks.membershipFindUnique.mockResolvedValue({ id: "m-web", companyId: "c1", status: "ACTIVE" });
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ priceListId: "pl-1", products: [washer], specialOptions: [], priceListSettings });
    mocks.orderCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "o1", ...data }));
    mocks.orderItemCreateMany.mockResolvedValue({ count: 0 });
    mocks.startBookingCheckout.mockResolvedValue({ ok: true, url: "https://checkout.stripe.com/cs_1" });
  });

  it("saves the order unpaid with a payment link token, and sends the customer to Stripe Checkout", async () => {
    const res = await post();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, orderNumber: "20012", checkoutUrl: "https://checkout.stripe.com/cs_1" });

    const data = mocks.orderCreate.mock.calls[0]![0].data;
    expect(data.status).toBe("processing");
    expect(data.paymentStatus).toBe("pending");
    expect(data.actionToken).toMatch(/^[a-f0-9]{32}$/);
    expect(mocks.startBookingCheckout).toHaveBeenCalledWith(expect.objectContaining({ id: "o1", actionToken: data.actionToken }));
  });

  it("leaves the staff alert and the customer's welcome email to the payment webhook", async () => {
    await post();

    expect(mocks.createOrderNotification).not.toHaveBeenCalled();
    expect(mocks.welcomeWebsiteOrderCustomer).not.toHaveBeenCalled();
  });

  it("says so when the payment couldn't be started (the order was cancelled)", async () => {
    mocks.startBookingCheckout.mockResolvedValue({ ok: false });

    const res = await post();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, reason: "PAYMENT_START_FAILED" });
  });

  it("keeps the faktura flow in manual mode: no payment status, no checkout, welcome right away", async () => {
    process.env.HOMEPAGE_PAYMENT_MODE = "manual";

    const res = await post();

    expect(res.status).toBe(200);
    expect((await res.json()).checkoutUrl).toBeUndefined();
    const data = mocks.orderCreate.mock.calls[0]![0].data;
    expect(data.paymentStatus).toBeUndefined();
    expect(mocks.startBookingCheckout).not.toHaveBeenCalled();
    expect(mocks.createOrderNotification).toHaveBeenCalled();
    expect(mocks.welcomeWebsiteOrderCustomer).toHaveBeenCalled();
  });
});
