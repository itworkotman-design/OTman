import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrderByActionTokenMock: vi.fn(),
  getWebsiteOrderCatalogMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderItemDeleteManyMock: vi.fn(),
  orderItemCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  createOrderUpdatedEventMock: vi.fn(),
  createOrderNotificationMock: vi.fn(),
  calculateBookingPricingMock: vi.fn(),
  buildOrderItemsFromCardsMock: vi.fn(),
  buildOrderSummariesMock: vi.fn(),
  buildOrderPricingSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { update: mocks.orderUpdateMock },
    orderItem: { deleteMany: mocks.orderItemDeleteManyMock, create: mocks.orderItemCreateMock },
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/orders/publicOrderAccess", async () => {
  const actual = await vi.importActual<typeof import("@/lib/orders/publicOrderAccess")>(
    "@/lib/orders/publicOrderAccess",
  );
  return { ...actual, getOrderByActionToken: mocks.getOrderByActionTokenMock };
});

vi.mock("@/lib/content/websiteOrderCatalog", () => ({
  getWebsiteOrderCatalog: mocks.getWebsiteOrderCatalogMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderUpdatedEvent: mocks.createOrderUpdatedEventMock,
}));

vi.mock("@/lib/orders/orderNotifications", () => ({
  createOrderNotification: mocks.createOrderNotificationMock,
}));

// The rest of the pricing pipeline is already tested elsewhere in this
// codebase (it's the exact same set of functions white-goods-order/route.ts
// uses to create an order) — these tests aren't re-verifying that pricing
// math, only this route's own decision logic (eligibility, invariant
// enforcement, decrease-rejection, alerting), so everything downstream of
// "what's the new total" is mocked directly.
vi.mock("@/lib/booking/pricing/snapshot", () => ({
  applyOrderPricingSnapshot: ({ catalogProducts, catalogSpecialOptions }: { catalogProducts: unknown; catalogSpecialOptions: unknown }) => ({
    catalogProducts,
    catalogSpecialOptions,
  }),
}));
vi.mock("@/lib/orders/buildOrderItemsFromCards", () => ({
  buildOrderItemsFromCards: mocks.buildOrderItemsFromCardsMock,
}));
vi.mock("@/lib/orders/buildOrderSummaries", () => ({
  buildOrderSummaries: mocks.buildOrderSummariesMock,
}));
vi.mock("@/lib/orders/orderTotals", () => ({
  buildOrderPricingSnapshot: mocks.buildOrderPricingSnapshotMock,
}));
vi.mock("@/lib/booking/pricing/websiteAssemblyExtras", () => ({
  applyWebsiteAssemblyExtras: (breakdowns: unknown) => breakdowns,
  buildWebsiteAssemblyExtraOrderItems: () => [],
}));
vi.mock("@/lib/booking/pricing/fromProductCards", () => ({
  buildProductBreakdowns: () => [],
}));
vi.mock("@/lib/booking/pricing/orderCalculatorExtras", () => ({
  parseDistanceKm: () => 0,
}));
vi.mock("@/lib/booking/pricing/whiteGoodsExtraUnits", () => ({
  applyWhiteGoodsExtraUnitCharges: (breakdowns: unknown) => breakdowns,
  buildWhiteGoodsExtraUnitOrderItems: () => [],
}));
vi.mock("@/lib/booking/pricing/buildWhiteGoodsCalculatorBreakdowns", () => ({
  buildWhiteGoodsCalculatorBreakdowns: () => [],
}));
vi.mock("@/lib/booking/pricing/engine", () => ({
  calculateBookingPricing: mocks.calculateBookingPricingMock,
}));
vi.mock("@/lib/booking/pricing/priceLookup", () => ({
  buildPriceLookup: () => ({}),
}));
vi.mock("@/lib/products/priceListSettings", () => ({
  normalizePriceListSettings: (settings: unknown) => settings,
}));

import { GET, POST } from "./route";

function req() {
  return new Request("http://localhost/api/public/orders/abc/edit-items");
}

function call(token = "a".repeat(32)) {
  return GET(req(), { params: Promise.resolve({ token }) });
}

function postReq(body: unknown) {
  return new Request("http://localhost/api/public/orders/abc/edit-items", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function postCall(body: unknown, token = "a".repeat(32)) {
  return POST(postReq(body), { params: Promise.resolve({ token }) });
}

const sampleCard = { cardId: 0, productId: "product-1", amount: 1, deliveryType: "FIRST_STEP" };

describe("GET /api/public/orders/[token]/edit-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWebsiteOrderCatalogMock.mockResolvedValue({
      products: [{ id: "product-1", code: "WG_DISHWASHER" }],
      specialOptions: [],
      priceListSettings: {},
      priceListIds: ["pl-1"],
    });
  });

  it("returns 404 for an unknown token", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("returns 409 when the order isn't confirmed yet", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({
      id: "order1",
      status: "approved",
      productCardsSnapshot: [sampleCard],
    });
    const res = await call();
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "NOT_ELIGIBLE" });
  });

  it("returns 409 when the order has no catalog-priced items to edit (e.g. Moving/special-goods/services)", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({
      id: "order1",
      status: "confirmed",
      productCardsSnapshot: null,
    });
    const res = await call();
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "NO_EDITABLE_ITEMS" });
  });

  it("returns the order's cards and the catalog when eligible", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({
      id: "order1",
      displayId: 42,
      productsSummary: "Dishwasher",
      status: "confirmed",
      productCardsSnapshot: [sampleCard],
    });

    const res = await call();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.displayId).toBe(42);
    expect(json.productCards).toEqual([sampleCard]);
    expect(json.catalogProducts).toEqual([{ id: "product-1", code: "WG_DISHWASHER" }]);
  });

  it("returns 500 when the catalog can't be loaded (not seeded)", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({
      id: "order1",
      status: "confirmed",
      productCardsSnapshot: [sampleCard],
    });
    mocks.getWebsiteOrderCatalogMock.mockRejectedValue(new Error("not seeded"));

    const res = await call();
    expect(res.status).toBe(500);
  });
});

const baseOrder = {
  id: "order1",
  companyId: "company1",
  displayId: 42,
  status: "confirmed",
  productCardsSnapshot: [sampleCard],
  priceExVat: 1000,
  drivingDistance: "10",
  expressDelivery: false,
  floorNo: "0",
  lift: "no",
  extraPickupAddress: [],
  rabatt: "",
  leggTil: "",
  subcontractorMinus: "",
  subcontractorPlus: "",
};

const submittedCard = { ...sampleCard, deliveryType: "INDOOR" };
const builtItem = {
  cardId: 0,
  productId: "product-1",
  productCode: "WG_DISHWASHER",
  productName: "Dishwasher",
  deliveryType: "INDOOR",
  itemType: "PRODUCT",
  optionId: null,
  optionCode: null,
  optionLabel: null,
  quantity: 1,
  customerPriceCents: 150000,
  subcontractorPriceCents: 100000,
  rawData: {},
};

describe("POST /api/public/orders/[token]/edit-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWebsiteOrderCatalogMock.mockResolvedValue({
      products: [{ id: "product-1", code: "WG_DISHWASHER" }],
      specialOptions: [],
      priceListSettings: {},
      priceListIds: ["pl-1"],
    });
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([builtItem]);
    mocks.buildOrderSummariesMock.mockReturnValue({ productsSummary: "Dishwasher" });
    mocks.buildOrderPricingSnapshotMock.mockReturnValue({ lines: [builtItem] });
    mocks.calculateBookingPricingMock.mockReturnValue({
      totals: { totalExVat: 1200, subcontractorTotal: 800 },
    });
    mocks.transactionMock.mockResolvedValue([]);
    mocks.createOrderUpdatedEventMock.mockResolvedValue(undefined);
    mocks.createOrderNotificationMock.mockResolvedValue(undefined);
  });

  it("returns 400 for an unparseable body", async () => {
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: "not json" }),
      { params: Promise.resolve({ token: "a".repeat(32) }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when productCards is missing or empty", async () => {
    const res = await postCall({ productCards: [] });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown token", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue(null);
    const res = await postCall({ productCards: [submittedCard] });
    expect(res.status).toBe(404);
  });

  it("returns 409 when the order isn't confirmed", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, status: "approved" });
    const res = await postCall({ productCards: [submittedCard] });
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "NOT_ELIGIBLE" });
  });

  it("returns 409 when the order has no editable items", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, productCardsSnapshot: null });
    const res = await postCall({ productCards: [submittedCard] });
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "NO_EDITABLE_ITEMS" });
  });

  it("returns 422 with the validation reason when the edit isn't allowed (e.g. quantity changed)", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue(baseOrder);
    const res = await postCall({ productCards: [{ ...submittedCard, amount: 2 }] });
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "QUANTITY_CHANGED" });
  });

  it("rejects an edit that leaves a size-priced product without its volume and weight brackets", async () => {
    const sizedCard = { ...sampleCard, selectedExtraOptionIds: ["vol-1", "wt-1"] };
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, productCardsSnapshot: [sizedCard] });
    mocks.getWebsiteOrderCatalogMock.mockResolvedValue({
      products: [
        {
          id: "product-1",
          code: "FN_OTHER_FURNITURE",
          options: [
            { id: "vol-1", category: "size_volume", active: true, customerPrice: "0" },
            { id: "wt-1", category: "size_weight", active: true, customerPrice: "0" },
          ],
        },
      ],
      specialOptions: [],
      priceListSettings: {},
      priceListIds: ["pl-1"],
    });

    const res = await postCall({ productCards: [{ ...sizedCard, selectedExtraOptionIds: ["vol-1"] }] });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "SIZE_BRACKETS_REQUIRED" });
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("does not accept a volume bracket the client claims without dimensions — it is derived from width/height/length", async () => {
    const sizedCard = { ...sampleCard, selectedExtraOptionIds: ["vol-1", "wt-1"], sizeDimensionsCm: { widthCm: 100, heightCm: 50, lengthCm: 50 } };
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, productCardsSnapshot: [sizedCard] });
    mocks.getWebsiteOrderCatalogMock.mockResolvedValue({
      products: [
        {
          id: "product-1",
          code: "FN_OTHER_FURNITURE",
          options: [
            { id: "vol-1", code: "OF_VOL_1", category: "size_volume", active: true, customerPrice: "0" },
            { id: "wt-1", code: "OF_WT_1", category: "size_weight", active: true, customerPrice: "0" },
          ],
        },
      ],
      specialOptions: [],
      priceListSettings: {},
      priceListIds: ["pl-1"],
    });

    // Same dimensions, but the claimed bracket removed and dimensions dropped: nothing left to derive from.
    const res = await postCall({ productCards: [{ ...sizedCard, sizeDimensionsCm: null }] });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "SIZE_BRACKETS_REQUIRED" });
  });

  it("rejects an edit that blanks the name of a size-priced item", async () => {
    const sizedCard = {
      ...sampleCard,
      modelNumber: "Grandfather clock",
      selectedExtraOptionIds: ["wt-1"],
      sizeDimensionsCm: { widthCm: 100, heightCm: 50, lengthCm: 50 },
    };
    mocks.getOrderByActionTokenMock.mockResolvedValue({ ...baseOrder, productCardsSnapshot: [sizedCard] });
    mocks.getWebsiteOrderCatalogMock.mockResolvedValue({
      products: [
        {
          id: "product-1",
          code: "FN_OTHER_FURNITURE",
          options: [
            { id: "vol-1", code: "OF_VOL_1", category: "size_volume", active: true, customerPrice: "0" },
            { id: "wt-1", code: "OF_WT_1", category: "size_weight", active: true, customerPrice: "0" },
          ],
        },
      ],
      specialOptions: [],
      priceListSettings: {},
      priceListIds: ["pl-1"],
    });

    const res = await postCall({ productCards: [{ ...sizedCard, modelNumber: "  " }] });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "ITEM_NAME_REQUIRED" });
  });

  it("rejects a change that would decrease the order total", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue(baseOrder);
    mocks.calculateBookingPricingMock.mockReturnValue({
      totals: { totalExVat: 500, subcontractorTotal: 400 },
    });

    const res = await postCall({ productCards: [submittedCard] });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "WOULD_DECREASE_PRICE" });
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("applies the change, persists it, and alerts staff when the total increases", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue(baseOrder);

    const res = await postCall({ productCards: [submittedCard] });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      previousPriceExVat: 1000,
      newPriceExVat: 1200,
      deltaExVat: 200,
    });

    expect(mocks.transactionMock).toHaveBeenCalledTimes(1);
    expect(mocks.orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order1" },
        data: expect.objectContaining({
          priceExVat: 1200,
          priceSubcontractor: 800,
          productsSummary: "Dishwasher",
          needsNotificationAttention: true,
        }),
      }),
    );
    expect(mocks.orderItemDeleteManyMock).toHaveBeenCalledWith({ where: { orderId: "order1" } });
    expect(mocks.orderItemCreateMock).toHaveBeenCalledTimes(1);
    expect(mocks.orderItemCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: "order1", productId: "product-1" }) }),
    );

    expect(mocks.createOrderUpdatedEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: "order1",
        companyId: "company1",
        changes: [
          expect.objectContaining({ field: "priceExVat", previousValue: "1000", nextValue: "1200" }),
        ],
      }),
    );
    expect(mocks.createOrderNotificationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order1", companyId: "company1", type: "MANUAL_REVIEW" }),
    );
  });

  it("returns 500 when the update fails unexpectedly", async () => {
    mocks.getOrderByActionTokenMock.mockResolvedValue(baseOrder);
    mocks.transactionMock.mockRejectedValue(new Error("db down"));

    const res = await postCall({ productCards: [submittedCard] });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "UPDATE_FAILED" });
  });
});
