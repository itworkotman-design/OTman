import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  orderCreate: vi.fn(),
  orderItemCreateMany: vi.fn(),
  getWebsiteOrderCatalog: vi.fn(),
}));

vi.mock("@/lib/customerAccounts/welcomeWebsiteOrderCustomer", () => ({ welcomeWebsiteOrderCustomer: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: mocks.membershipFindUnique },
    order: { create: mocks.orderCreate },
    orderItem: { createMany: mocks.orderItemCreateMany },
  },
}));
vi.mock("@/lib/content/websiteOrderCatalog", () => ({ getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalog }));
vi.mock("@/lib/orders/orderNumber", () => ({ reserveNextManualOrderNumber: vi.fn().mockResolvedValue(20012) }));
vi.mock("@/lib/orders/publicOrderNumber", () => ({ reservePublicOrderNumber: vi.fn().mockResolvedValue("G8SMMP58") }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderCreatedEvent: vi.fn(), buildOrderEventSnapshot: vi.fn() }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: vi.fn() }));

import { createEmptyProductCard, type CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { normalizePriceListSettings } from "@/lib/products/priceListSettings";
import { priceWebsiteOrder } from "@/lib/booking/pricing/priceWebsiteOrder";

const deliveryType = (key: string, price: string, label: string) => ({
  key: key as CatalogProduct["deliveryTypes"][number]["key"],
  enabled: true,
  code: key,
  label,
  price,
  subcontractorPrice: "100",
  xtraPrice: "235",
  xtraSubcontractorPrice: "50",
  allowInstallOptions: true,
  allowExtraServices: true,
  allowReturnOptions: true,
  allowModelNumber: false,
});

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
  deliveryTypes: [deliveryType(DELIVERY_TYPES.INDOOR, "690", "Delivery with carry-in")],
  customSections: [],
  options: [
    {
      id: "ret-1",
      code: "RETURN_RECYCLING",
      label: "Retur av gammel vare til gjenvinning",
      description: "",
      category: "return",
      customerPrice: "260",
      subcontractorPrice: "120",
      effectiveCustomerPrice: "260",
      active: true,
    },
  ],
};
const priceListSettings = normalizePriceListSettings(null);

const cards = [
  { ...createEmptyProductCard(0), productId: "p-wm", amount: 1, deliveryType: DELIVERY_TYPES.INDOOR, selectedReturnOptionId: "ret-1" },
];

function serverTotal(drivingDistance: string) {
  return priceWebsiteOrder({
    cards,
    catalogProducts: [washer],
    catalogSpecialOptions: [],
    priceListSettings,
    drivingDistance,
    expressDelivery: false,
    extraPickups: [],
    pickupFloor: 0,
    deliveryFloor: 0,
    pickupLiftAvailable: true,
    deliveryLiftAvailable: false,
    extraPickupFloors: [],
  }).result.totals.totalExVat;
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    productCards: cards,
    pickupSource: "store",
    pickupPlaceName: "Power",
    pickupAddress: "Smalvollveien 65, Oslo",
    deliveryAddress: "Otto Blehrs vei 25c, Nesøya",
    drivingDistance: "171.12",
    name: "Ralfs",
    phone: "93004023",
    email: "customer@example.com",
    ...overrides,
  };
}

async function post(payload: unknown) {
  vi.resetModules();
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/site/white-goods-order", { method: "POST", body: JSON.stringify(payload) }));
}

describe("POST /api/site/white-goods-order — the price the customer saw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEBSITE_MEMBERSHIP_ID = "m-web";
    mocks.membershipFindUnique.mockResolvedValue({ id: "m-web", companyId: "c1", status: "ACTIVE" });
    mocks.getWebsiteOrderCatalog.mockResolvedValue({
      priceListId: "pl-1",
      products: [washer],
      specialOptions: [],
      priceListSettings,
    });
    mocks.orderCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "o1", ...data }));
    mocks.orderItemCreateMany.mockResolvedValue({ count: 0 });
  });

  it("stores the order at exactly the total the customer was shown, with lines that add up to it", async () => {
    const total = serverTotal("171.12");
    const res = await post(body({ shownTotal: total }));
    expect(res.status).toBe(200);

    const data = mocks.orderCreate.mock.calls[0]![0].data;
    expect(data.priceExVat).toBe(Math.round(total));
    expect(data.websiteBookingDetails.shownTotal).toBe(total);

    const items = mocks.orderItemCreateMany.mock.calls[0]![0].data as { customerPriceCents: number | null; itemType: string }[];
    expect(items).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemType: "RETURN_OPTION", customerPriceCents: 26000 })]),
    );
    const linesTotal = items.reduce((sum, item) => sum + (item.customerPriceCents ?? 0), 0) / 100;
    const extrasTotal = (data.websiteBookingDetails.orderExtras as { price: number }[]).reduce((s, e) => s + e.price, 0);
    expect(linesTotal + extrasTotal).toBeCloseTo(total, 2);
  });

  it("refuses the order when the shown total isn't what the server calculates, and says the real price", async () => {
    const total = serverTotal("171.12");
    const res = await post(body({ shownTotal: total + 1160 }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "PRICE_CHANGED", total });
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it("stores which product cards each pickup stop collects", async () => {
    const total = serverTotal("171.12");
    const res = await post(body({ shownTotal: total, pickupCardIds: [0, "x"] }));
    expect(res.status).toBe(200);
    expect(mocks.orderCreate.mock.calls[0]![0].data.websiteBookingDetails.pickups[0].cardIds).toEqual([0]);
  });

  it("writes one description line per pickup stop", async () => {
    const total = serverTotal("171.12");
    const res = await post(
      body({
        shownTotal: total,
        pickupPlaceName: "power",
        pickupProductNames: ["Vaskemaskin"],
        extraPickupLocations: [
          {
            source: "private",
            address: "Eivind Olsens vei, 3016 Drammen, Norge",
            floor: 10,
            liftAvailable: false,
            contactName: "troll",
            contactPhone: "00000000",
            productNames: ["Kommode"],
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.orderCreate.mock.calls[0]![0].data.description).toBe(
      [
        "Pickup 1 - Store: Power (Smalvollveien 65, Oslo) - picking up: Vaskemaskin",
        "",
        "Pickup 2 - Private: Troll / 00000000 (Eivind Olsens vei, 3016 Drammen, Norge) - picking up: Kommode",
        "    *floor 10, no lift",
      ].join("\n"),
    );
  });

  it("refuses an order that doesn't say what total the customer saw", async () => {
    const res = await post(body());
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("SHOWN_TOTAL_REQUIRED");
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });
});
