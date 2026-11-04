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
  options: [
    { id: "inst", code: "WM_INSTALL", label: "Install", description: "Install", category: "install", customerPrice: "400", subcontractorPrice: "200", effectiveCustomerPrice: "400", active: true },
  ] as unknown as CatalogProduct["options"],
};
const priceListSettings = normalizePriceListSettings(null);
const plain = [{ ...createEmptyProductCard(0), productId: "p-wm", amount: 1, deliveryType: DELIVERY_TYPES.INDOOR }];
const installed = [{ ...plain[0]!, selectedInstallOptionIds: ["inst"] }];
let cards = installed;

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

function body(extra: Record<string, unknown> = {}) {
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
    ...extra,
  };
}

async function post(extra: Record<string, unknown> = {}) {
  vi.resetModules();
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/site/white-goods-order", { method: "POST", body: JSON.stringify(body(extra)) }));
}

describe("POST /api/site/white-goods-order — asking to have a service done within the withdrawal period", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cards = installed;
    process.env.WEBSITE_MEMBERSHIP_ID = "m-web";
    process.env.HOMEPAGE_PAYMENT_MODE = "stripe";
    mocks.membershipFindUnique.mockResolvedValue({ id: "m-web", companyId: "c1", status: "ACTIVE" });
    mocks.getWebsiteOrderCatalog.mockResolvedValue({ priceListId: "pl-1", products: [washer], specialOptions: [], priceListSettings });
    mocks.orderCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "o1", ...data }));
    mocks.orderItemCreateMany.mockResolvedValue({ count: 0 });
    mocks.startBookingCheckout.mockResolvedValue({ ok: true, url: "https://checkout.stripe.com/cs_1" });
  });

  it("refuses a private customer's installation without the consent, before saving anything", async () => {
    const res = await post();

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, reason: "VALIDATION_FAILED", errors: { withdrawalConsent: expect.any(String) } });
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it("stores when the customer gave it", async () => {
    const before = Date.now();
    const res = await post({ withdrawalConsent: true });

    expect(res.status).toBe(200);
    const at = mocks.orderCreate.mock.calls[0]![0].data.withdrawalConsentAt as Date;
    expect(at).toBeInstanceOf(Date);
    expect(at.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("doesn't ask a business, or for a plain delivery", async () => {
    expect((await post({ customerType: "business", orgNumber: "923609016" })).status).toBe(200);
    expect(mocks.orderCreate.mock.calls[0]![0].data.withdrawalConsentAt).toBeUndefined();

    cards = plain;
    expect((await post()).status).toBe(200);
    expect(mocks.orderCreate.mock.calls[1]![0].data.withdrawalConsentAt).toBeUndefined();
  });

  it("ignores a consent sent for an order with nothing to consent to", async () => {
    cards = plain;
    await post({ withdrawalConsent: true });
    expect(mocks.orderCreate.mock.calls[0]![0].data.withdrawalConsentAt).toBeUndefined();
  });
});
