import type { Order } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { buildOrderPayload } from "@/lib/integrations/gsm/buildOrderPayload";

function buildOrder(overrides?: Partial<Order>): Order {
  return {
    id: "order-1",
    createdAt: new Date("2026-04-20T09:00:00.000Z"),
    updatedAt: new Date("2026-04-20T09:00:00.000Z"),
    companyId: "company-1",
    createdByMembershipId: "membership-1",
    customerMembershipId: null,
    priceListId: null,
    displayId: 12,
    orderNumber: "A-1",
    description: null,
    modelNr: null,
    deliveryDate: "2026-04-21",
    timeWindow: "10:00-16:00",
    expressDelivery: false,
    contactCustomerForCustomTimeWindow: false,
    customTimeContactNote: null,
    pickupAddress: "Pickup 1",
    extraPickupAddress: [],
    extraPickupContacts: null,
    deliveryAddress: "Delivery 1",
    returnAddress: null,
    drivingDistance: null,
    customerName: "Customer",
    customerLabel: "Customer",
    phone: "12345678",
    phoneTwo: null,
    email: "customer@example.com",
    customerComments: null,
    floorNo: null,
    lift: null,
    cashierName: "Cashier",
    cashierPhone: "87654321",
    subcontractorMembershipId: null,
    subcontractor: null,
    driver: null,
    secondDriver: null,
    driverInfo: null,
    licensePlate: null,
    deviation: null,
    feeExtraWork: false,
    feeAddToOrder: false,
    statusNotes: null,
    status: null,
    dontSendEmail: false,
    priceExVat: 0,
    priceSubcontractor: 0,
    rabatt: null,
    leggTil: null,
    subcontractorMinus: null,
    subcontractorPlus: null,
    productsSummary: "Product",
    deliveryTypeSummary: "Kun retur",
    servicesSummary: "Montering",
    gsmOrderId: null,
    gsmExternalId: null,
    gsmLastTaskState: null,
    gsmSyncStatus: null,
    gsmSentAt: null,
    gsmLastWebhookAt: null,
    gsmLastSyncedAt: null,
    emailThreadToken: null,
    lastInboundEmailAt: null,
    lastOutboundEmailAt: null,
    needsEmailAttention: false,
    unreadInboundEmailCount: 0,
    lastNotificationAt: null,
    needsNotificationAttention: false,
    unreadNotificationCount: 0,
    productCardsSnapshot: null,
    lastEditedByMembershipId: null,
    legacyWordpressOrderId: null,
    legacyWordpressAuthorId: null,
    legacyWordpressRawMeta: null,
    ...overrides,
  };
}

describe("buildOrderPayload", () => {
  afterEach(() => {
    delete process.env.GSM_ACCOUNT_URL;
  });

  it("omits the pickup task when the order only has the pickup placeholder", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "No shop pickup address",
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
      }),
    );

    expect(payload.tasks_data).toHaveLength(2);
    expect(payload.tasks_data.map((task) => task.category)).toEqual([
      "assignment",
      "drop_off",
    ]);
    expect(
      payload.tasks_data.some(
        (task) => task.address.raw_address === "No shop pickup address",
      ),
    ).toBe(false);
  });

  it("omits placeholder extra pickup addresses but keeps real ones", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "",
        extraPickupAddress: ["No shop pickup address", "Pickup 2"],
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
    );

    expect(payload.tasks_data.map((task) => task.address.raw_address)).toEqual([
      "Pickup 2",
      "Delivery 1",
    ]);
    expect(payload.tasks_data.map((task) => task.category)).toEqual([
      "pick_up",
      "drop_off",
    ]);
  });

  it("uses grouped order items in the GSM description when available", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        productsSummary: "Legacy product",
        deliveryTypeSummary: "Legacy delivery",
        servicesSummary: "Legacy service",
        description: "Handle with care",
      }),
      items: [
        {
          id: "item-1",
          createdAt: new Date("2026-04-20T09:00:00.000Z"),
          orderId: "order-1",
          cardId: 1,
          productId: "product-1",
          productCode: "WASHER",
          productName: "Washer",
          deliveryType: "Indoor carry",
          itemType: "PRODUCT_CARD",
          optionId: null,
          optionCode: null,
          optionLabel: null,
          quantity: 2,
          customerPriceCents: 0,
          subcontractorPriceCents: 0,
          rawData: null,
        },
        {
          id: "item-2",
          createdAt: new Date("2026-04-20T09:00:00.000Z"),
          orderId: "order-1",
          cardId: 1,
          productId: "product-1",
          productCode: "INSTALL",
          productName: "Washer",
          deliveryType: "Indoor carry",
          itemType: "SPECIAL_OPTION",
          optionId: "option-1",
          optionCode: "INSTALL_ONLY",
          optionLabel: "Install only",
          quantity: 2,
          customerPriceCents: 0,
          subcontractorPriceCents: 0,
          rawData: {
            description: "Install only",
          },
        },
      ],
    });

    expect(payload.tasks_data[0]?.description).toContain("Washer x2");
    expect(payload.tasks_data[0]?.description).toContain("- Indoor carry x2");
    expect(payload.tasks_data[0]?.description).toContain("- Install only x2");
    expect(payload.tasks_data[0]?.description).toContain("Handle with care");
    expect(payload.tasks_data[0]?.description).not.toContain("Legacy product");
  });
});
