import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBookingCatalogMock: vi.fn(),
  computeFullOrderTotalMock: vi.fn(),
  buildOrderSummariesMock: vi.fn(),
  buildOrderItemsFromCardsMock: vi.fn(),
  buildOrderEventSnapshotMock: vi.fn(),
  createOrderCreatedEventMock: vi.fn(),
  reserveNextManualOrderNumberMock: vi.fn(),
  sendOrderNotificationEmailMock: vi.fn(),
  sendExtraPickupNotificationEmailMock: vi.fn(),
  createExtraPickupAlertMock: vi.fn(),
  createSubcontractorPriceAlertMock: vi.fn(),
  createTodayDeliveryAlertMock: vi.fn(),
  createNoDeliveryDateAlertMock: vi.fn(),
  createContactCustomerAlertMock: vi.fn(),
  createCapacityAlertMock: vi.fn(),
  countOrdersInDeliverySlotMock: vi.fn(),
  orderCreateMock: vi.fn(),
  orderItemCreateManyMock: vi.fn(),
}));

vi.mock("@/lib/booking/catalog/getBookingCatalog", () => ({
  getBookingCatalog: mocks.getBookingCatalogMock,
}));

// The full pricing engine (buildProductBreakdowns/buildCalculatorBreakdownsWithOrderExtras/
// calculateBookingPricing) is exercised directly in computeOrderTotal.test.ts and
// engine.test.ts/fromProductCards.test.ts — this test only needs to verify createOrder
// wires its result in correctly when there's no client-submitted total.
vi.mock("@/lib/booking/pricing/computeOrderTotal", () => ({
  computeFullOrderTotal: mocks.computeFullOrderTotalMock,
}));

vi.mock("@/lib/orders/buildOrderSummaries", () => ({
  buildOrderSummaries: mocks.buildOrderSummariesMock,
}));

vi.mock("@/lib/orders/buildOrderItemsFromCards", () => ({
  buildOrderItemsFromCards: mocks.buildOrderItemsFromCardsMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  buildOrderEventSnapshot: mocks.buildOrderEventSnapshotMock,
  createOrderCreatedEvent: mocks.createOrderCreatedEventMock,
}));

vi.mock("@/lib/orders/orderNumber", () => ({
  reserveNextManualOrderNumber: mocks.reserveNextManualOrderNumberMock,
}));

vi.mock("@/lib/orders/orderNotificationEmail", () => ({
  sendOrderNotificationEmail: mocks.sendOrderNotificationEmailMock,
  sendExtraPickupNotificationEmail: mocks.sendExtraPickupNotificationEmailMock,
}));

vi.mock("@/lib/orders/alerts", () => ({
  createExtraPickupAlert: mocks.createExtraPickupAlertMock,
  createSubcontractorPriceAlert: mocks.createSubcontractorPriceAlertMock,
  createTodayDeliveryAlert: mocks.createTodayDeliveryAlertMock,
  createNoDeliveryDateAlert: mocks.createNoDeliveryDateAlertMock,
  createContactCustomerAlert: mocks.createContactCustomerAlertMock,
  createCapacityAlert: mocks.createCapacityAlertMock,
}));

vi.mock("@/lib/orders/capacity", () => ({
  ORDER_SLOT_LIMIT: 10,
  countOrdersInDeliverySlot: mocks.countOrdersInDeliverySlotMock,
  isDeliverySlotOverCapacity: () => false,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { create: mocks.orderCreateMock },
    orderItem: { createMany: mocks.orderItemCreateManyMock },
  },
}));

import { createOrder, type CreateOrderFields } from "./createOrder";

function baseFields(): CreateOrderFields {
  return {
    description: null,
    modelNr: null,
    deliveryDate: "2026-07-06",
    timeWindow: "10:00-16:00",
    expressDelivery: false,
    contactCustomerForCustomTimeWindow: false,
    customTimeContactNote: null,
    pickupAddress: null,
    extraPickups: [],
    returnAddress: null,
    deliveryAddress: "Delivery 1",
    drivingDistance: null,
    customerName: null,
    phone: null,
    phoneTwo: null,
    email: null,
    customerComments: null,
    floorNo: null,
    lift: null,
    cashierName: null,
    cashierPhone: null,
    subcontractorId: null,
    subcontractor: null,
    driver: null,
    secondDriver: null,
    driverInfo: null,
    licensePlate: null,
    deviation: null,
    feeExtraWork: false,
    extraWorkMinutes: 0,
    feeAddToOrder: false,
    statusNotes: null,
    status: null,
    dontSendEmail: true,
    rabatt: null,
    dnbDiscount: false,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    customerMembershipId: "membership-1",
    customerLabel: "Customer",
    // priceExVat/priceSubcontractor deliberately omitted — the case under test.
  };
}

describe("createOrder pricing fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBookingCatalogMock.mockResolvedValue({
      products: [],
      specialOptions: [],
      priceListSettings: {},
    });
    mocks.buildOrderSummariesMock.mockReturnValue({
      productsSummary: "",
      deliveryTypeSummary: "",
      servicesSummary: "",
    });
    mocks.buildOrderEventSnapshotMock.mockReturnValue({});
    mocks.reserveNextManualOrderNumberMock.mockResolvedValue(20000);
    mocks.orderItemCreateManyMock.mockResolvedValue({});
    mocks.orderCreateMock.mockImplementation(({ data }) =>
      Promise.resolve({ id: "order-1", createdAt: new Date(), ...data }),
    );
  });

  it("uses the full server-computed total (product lines + order extras) when no fallback total is submitted", async () => {
    // This reproduces the automatic-orders bug: the generator has no frozen
    // total to fall back to (unlike a manual booking submission, which
    // always has one), so priceExVat/priceSubcontractor are omitted. The
    // full total (2408 = 1318 in product lines + 500 express delivery + 590
    // extra pickup, per the real bug report) must come from
    // computeFullOrderTotal, not just from summing OrderItem lines — that
    // sum alone (1318) is what caused the original under-count.
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([
      { cardId: 0, itemType: "EXTRA_OPTION", quantity: 1, customerPriceCents: 66900, subcontractorPriceCents: 45000 },
      { cardId: 0, itemType: "INSTALL_OPTION", quantity: 1, customerPriceCents: 39900, subcontractorPriceCents: 19900 },
      { cardId: 0, itemType: "RETURN_OPTION", quantity: 1, customerPriceCents: 25000, subcontractorPriceCents: 15000 },
    ]);
    mocks.computeFullOrderTotalMock.mockReturnValue({ totalExVat: 2408, subcontractorTotal: 1489 });

    const order = await createOrder({
      companyId: "company-1",
      membershipId: "membership-1",
      orderNumber: null,
      productCards: [],
      priceListId: "price-list-1",
      actor: { name: "Staff", email: "staff@example.com", source: "SYSTEM" },
      companyOrderEmailsEnabled: false,
      fields: { ...baseFields(), expressDelivery: true },
    });

    expect(order.priceExVat).toBe(2408);
    expect(order.priceSubcontractor).toBe(1489);
    expect(mocks.computeFullOrderTotalMock).toHaveBeenCalledWith(
      expect.objectContaining({ expressDelivery: true }),
    );

    const createCallData = mocks.orderCreateMock.mock.calls[0][0].data;
    expect(createCallData.priceExVat).toBe(2408);
    expect(createCallData.priceSubcontractor).toBe(1489);
  });

  it("still allows an explicit fallback total to take priority (manual order behavior unchanged)", async () => {
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([
      { cardId: 0, itemType: "EXTRA_OPTION", quantity: 1, customerPriceCents: 66900, subcontractorPriceCents: 45000 },
    ]);

    const order = await createOrder({
      companyId: "company-1",
      membershipId: "membership-1",
      orderNumber: null,
      productCards: [],
      priceListId: "price-list-1",
      actor: { name: "Staff", email: "staff@example.com", source: "USER" },
      companyOrderEmailsEnabled: false,
      fields: { ...baseFields(), priceExVat: 300, priceSubcontractor: 900 },
    });

    expect(order.priceExVat).toBe(300);
    expect(order.priceSubcontractor).toBe(900);
    expect(mocks.computeFullOrderTotalMock).not.toHaveBeenCalled();
  });
});
