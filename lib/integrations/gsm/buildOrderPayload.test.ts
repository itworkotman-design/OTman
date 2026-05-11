import type { Order, OrderItem } from "@prisma/client";
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
    extraWorkMinutes: 0,
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
    orderCreatorEmailReadAt: null,
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
    completedAt: null,
    gdprAnonymized: false,
    gdprDeletedAt: null,
    ...overrides,
  };
}

function buildOrderItem(overrides?: Partial<OrderItem>): OrderItem {
  return {
    id: "item-1",
    createdAt: new Date("2026-04-20T09:00:00.000Z"),
    orderId: "order-1",
    cardId: 1,
    productId: "product-1",
    productCode: "WASHER",
    productName: "Washer",
    deliveryType: "Innbæring",
    itemType: "PRODUCT_CARD",
    optionId: null,
    optionCode: null,
    optionLabel: null,
    quantity: 1,
    customerPriceCents: 0,
    subcontractorPriceCents: 0,
    rawData: null,
    ...overrides,
  };
}

describe("buildOrderPayload", () => {
  afterEach(() => {
    delete process.env.GSM_ACCOUNT_URL;
  });

  it("omits the pickup task when the order only has the pickup placeholder", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "No shop pickup address",
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
      }),
      items: [
        buildOrderItem({
          itemType: "INSTALL_OPTION",
          optionCode: "INSWASH1",
          optionLabel: "Install service",
          rawData: { category: "install" },
        }),
      ],
    });

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
    expect(payload.tasks_data[0]?.description).toContain("Heis - No");
    expect(payload.tasks_data[0]?.description).not.toContain("Legacy product");
  });

  it("adds lift and floor details to the GSM description", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        floorNo: "4",
        lift: "yes",
      }),
    );

    expect(payload.tasks_data[0]?.description).toContain("Heis - Ja");
    expect(payload.tasks_data[0]?.description).toContain("Etasje - 4");
  });

  it("keeps innbaering deliveries as drop-off tasks", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
      items: [buildOrderItem({ deliveryType: "Innbæring" })],
    });

    expect(payload.tasks_data.map((task) => task.category)).toEqual([
      "drop_off",
    ]);
  });

  it("uses assignment for delivery when an order item is an install option", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
      items: [
        buildOrderItem({
          deliveryType: "Kun Installasjon/Montering",
        }),
        buildOrderItem({
          id: "item-2",
          itemType: "INSTALL_OPTION",
          optionCode: "INSWASH1",
          optionLabel: "Install service",
          rawData: { category: "install" },
        }),
      ],
    });

    expect(payload.tasks_data.map((task) => task.category)).toEqual([
      "assignment",
    ]);
  });

  it("uses assignment for innbaering when install options are selected", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
      items: [
        buildOrderItem({
          deliveryType: "Innbæring",
        }),
        buildOrderItem({
          id: "item-2",
          deliveryType: "Innbæring",
          itemType: "INSTALL_OPTION",
          optionCode: "INSWASH1",
          optionLabel: "Install service",
          rawData: { category: "install" },
        }),
      ],
    });

    expect(payload.tasks_data.map((task) => task.category)).toEqual([
      "assignment",
    ]);
  });

  it("keeps first-step deliveries as drop-off tasks", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
      items: [
        buildOrderItem({
          deliveryType: "FÃ¸rste trinn",
          rawData: { deliveryType: "FIRST_STEP" },
        }),
      ],
    });

    expect(payload.tasks_data.map((task) => task.category)).toEqual([
      "drop_off",
    ]);
  });

  it("uses assignment for install-only delivery type", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
      items: [
        buildOrderItem({
          deliveryType: "Kun Installasjon/Montering",
        }),
      ],
    });

    expect(payload.tasks_data.map((task) => task.category)).toEqual([
      "assignment",
    ]);
  });

  it("uses pickup for return-in delivery type", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
      items: [
        buildOrderItem({
          deliveryType: "Kun retur",
          optionCode: "RETURNIN",
          rawData: { deliveryType: "RETURN_ONLY" },
        }),
      ],
    });

    expect(payload.tasks_data.map((task) => task.category)).toEqual([
      "pick_up",
    ]);
  });

  it("adds a return address as a drop-off task when provided", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
        servicesSummary: "",
      }),
      items: [buildOrderItem({ deliveryType: "Innbæring" })],
    });

    expect(payload.tasks_data.map((task) => task.category)).toEqual([
      "drop_off",
      "drop_off",
    ]);
    expect(payload.tasks_data.map((task) => task.address.raw_address)).toEqual([
      "Delivery 1",
      "Return 1",
    ]);
  });

  it("uses canonical GSM text for return-to-store option codes", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        servicesSummary: "",
      }),
      items: [
        buildOrderItem(),
        buildOrderItem({
          id: "item-2",
          itemType: "RETURN_OPTION",
          optionCode: "RETURNSTORE",
          optionLabel: "Wrong saved return label",
          rawData: {
            code: "RETURNSTORE",
            description: "Wrong saved return description",
          },
        }),
      ],
    });

    expect(payload.tasks_data[0]?.description).toContain("Retur til butikk");
    expect(payload.tasks_data[0]?.description).not.toContain(
      "Wrong saved return label",
    );
    expect(payload.tasks_data[0]?.description).not.toContain(
      "Wrong saved return description",
    );
  });

  it("uses canonical GSM text for recycling-station return option codes", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        servicesSummary: "",
      }),
      items: [
        buildOrderItem(),
        buildOrderItem({
          id: "item-2",
          itemType: "RETURN_OPTION",
          optionCode: "RETURNREC",
          optionLabel: "Wrong saved return label",
          rawData: {
            mappedOptionCode: "RETURNREC",
            description: "Wrong saved return description",
          },
        }),
      ],
    });

    expect(payload.tasks_data[0]?.description).toContain(
      "Retur til gjenvinningsstasjon",
    );
    expect(payload.tasks_data[0]?.description).not.toContain(
      "Wrong saved return label",
    );
    expect(payload.tasks_data[0]?.description).not.toContain(
      "Wrong saved return description",
    );
  });
});
