// Store pickup documents uploaded through ./pickup-document are promoted out
// of tmp/ and linked to the new order on submit.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindUnique: vi.fn(),
  orderCreate: vi.fn(),
  orderItemCreateMany: vi.fn(),
  getWebsiteOrderCatalog: vi.fn(),
  promotePendingQuoteAttachments: vi.fn(),
  linkPendingQuoteAttachments: vi.fn(),
  pendingQuoteAttachmentFindMany: vi.fn(),
}));

vi.mock("@/lib/customerAccounts/welcomeWebsiteOrderCustomer", () => ({ welcomeWebsiteOrderCustomer: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: mocks.membershipFindUnique },
    order: { create: mocks.orderCreate },
    orderItem: { createMany: mocks.orderItemCreateMany },
    pendingQuoteAttachment: { findMany: mocks.pendingQuoteAttachmentFindMany },
  },
}));
vi.mock("@/lib/content/websiteOrderCatalog", () => ({ getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalog }));
vi.mock("@/lib/orders/orderNumber", () => ({ reserveNextManualOrderNumber: vi.fn().mockResolvedValue(20012) }));
vi.mock("@/lib/orders/publicOrderNumber", () => ({ reservePublicOrderNumber: vi.fn().mockResolvedValue("G8SMMP58") }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderCreatedEvent: vi.fn(), buildOrderEventSnapshot: vi.fn() }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: vi.fn() }));
vi.mock("@/lib/orders/orderAttachmentStorage", () => ({ promoteTempAttachmentToOrders: vi.fn() }));
vi.mock("@/lib/orders/pendingQuoteAttachments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/pendingQuoteAttachments")>()),
  promotePendingQuoteAttachments: mocks.promotePendingQuoteAttachments,
  linkPendingQuoteAttachments: mocks.linkPendingQuoteAttachments,
}));

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

// The server's price: ex. VAT (stored) and incl. VAT summed per line (what the
// customer is shown and confirms as shownTotal).
function serverPrice(drivingDistance: string) {
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
  }).customerTotals;
}

function serverTotal(drivingDistance: string) {
  return serverPrice(drivingDistance).totalIncVat;
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
    preferredDate: "2030-01-08",
    timeWindow: "10:00-16:00",
    ...overrides,
  };
}

async function post(payload: unknown) {
  vi.resetModules();
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/site/white-goods-order", { method: "POST", body: JSON.stringify(payload) }));
}

const TOKEN = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("POST /api/site/white-goods-order — store pickup documents", () => {
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
    mocks.promotePendingQuoteAttachments.mockResolvedValue(1);
    mocks.linkPendingQuoteAttachments.mockResolvedValue(1);
    mocks.pendingQuoteAttachmentFindMany.mockResolvedValue([{ filename: "Pickup 1 - kvittering.pdf" }]);
  });

  it("promotes the staged documents before creating the order, then links them to it", async () => {
    const res = await post(body({ shownTotal: serverTotal("171.12"), pickupDocumentToken: TOKEN }));
    expect(res.status).toBe(200);

    expect(mocks.promotePendingQuoteAttachments).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ quoteToken: TOKEN }),
    );
    expect(mocks.promotePendingQuoteAttachments.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.orderCreate.mock.invocationCallOrder[0]!,
    );
    expect(mocks.linkPendingQuoteAttachments).toHaveBeenCalledWith(expect.anything(), {
      orderId: "o1",
      quoteToken: TOKEN,
      source: "pickup-document",
    });
  });

  it("does nothing with attachments when no stop is a store", async () => {
    const res = await post(
      body({ shownTotal: serverTotal("171.12"), pickupSource: "private", pickupContactName: "Ola", pickupContactPhone: "93004023", pickupFloor: 1, pickupLiftAvailable: true }),
    );
    expect(res.status).toBe(200);
    expect(mocks.promotePendingQuoteAttachments).not.toHaveBeenCalled();
    expect(mocks.linkPendingQuoteAttachments).not.toHaveBeenCalled();
  });

  it("requires a document for a store pickup", async () => {
    const res = await post(body({ shownTotal: serverTotal("171.12") }));
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toHaveProperty("pickupDocument");
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it("requires the document to actually be uploaded under the token", async () => {
    mocks.pendingQuoteAttachmentFindMany.mockResolvedValue([]);
    const res = await post(body({ shownTotal: serverTotal("171.12"), pickupDocumentToken: TOKEN }));
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toHaveProperty("pickupDocument");
    expect(mocks.pendingQuoteAttachmentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { quoteToken: TOKEN } }));
  });

  it("requires one for every store stop, extra stops included", async () => {
    const res = await post(
      body({
        shownTotal: serverTotal("171.12"),
        pickupDocumentToken: TOKEN,
        extraPickupLocations: [{ source: "store", placeName: "Elkjøp", address: "Storgata 1, Oslo", productNames: [] }],
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toHaveProperty("pickupDocument");
  });

  it("rejects a malformed token", async () => {
    const res = await post(body({ shownTotal: serverTotal("171.12"), pickupDocumentToken: "../../etc" }));
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toHaveProperty("pickupDocumentToken");
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it("leaves the documents staged when the price changed (the customer resubmits with the same token)", async () => {
    const res = await post(body({ shownTotal: serverTotal("171.12") + 100, pickupDocumentToken: TOKEN }));
    expect(res.status).toBe(409);
    expect(mocks.promotePendingQuoteAttachments).not.toHaveBeenCalled();
  });

  it("fails without creating an order when the documents can't be moved", async () => {
    mocks.promotePendingQuoteAttachments.mockRejectedValue(new Error("copy failed"));
    const res = await post(body({ shownTotal: serverTotal("171.12"), pickupDocumentToken: TOKEN }));
    expect(res.status).toBe(500);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });
});
