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
    customPickupAddressId: null,
    customPickupAddressName: null,
    customPickupAddressPhone: null,
    pickupLatitude: null,
    pickupLongitude: null,
    customReturnAddressId: null,
    customReturnAddressName: null,
    customReturnAddressPhone: null,
    returnLatitude: null,
    returnLongitude: null,
    extraPickupAddress: [],
    extraPickupContacts: null,
    deliveryAddress: "Delivery 1",
    deliveryLatitude: null,
    deliveryLongitude: null,
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
    dnbDiscount: false,
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
    pricingSnapshot: null,
    lastEditedByMembershipId: null,
    legacyWordpressOrderId: null,
    legacyWordpressAuthorId: null,
    legacyWordpressRawMeta: null,
    completedAt: null,
    gdprAnonymized: false,
    gdprDeletedAt: null,
    paidAt: null,
    invoicedAt: null,
    gdprHold: false,
    gdprHoldReason: null,
    gdprHoldSetAt: null,
    recurringOrderTemplateId: null,
    recurringOrderOccurrenceDate: null,
    isWebsiteOrder: false,
    approvedAt: null,
    rejectedAt: null,
    actionToken: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeAmountChargedCents: null,
    paymentRequestSentAt: null,
    paymentReminderSentAt: null,
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
    delete process.env.GOOGLE_REVIEW_QR_URL;
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
    expect(payload.tasks_data[0]?.description).toContain("Heis - Nei");
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

  it("sends the no radio value as no lift in the GSM description", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        floorNo: "4",
        lift: "no",
      }),
    );

    expect(payload.tasks_data[0]?.description).toContain("Heis - Nei");
    expect(payload.tasks_data[0]?.description).toContain("Etasje - 4");
    expect(payload.tasks_data[0]?.description).not.toContain("Heis - Ja");
  });

  it.each(["", "No", "nei"])(
    "defaults non-radio lift value %s to no lift in the GSM description",
    (lift) => {
      process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

      const payload = buildOrderPayload(
        buildOrder({
          floorNo: "4",
          lift,
        }),
      );

      expect(payload.tasks_data[0]?.description).toContain("Heis - Nei");
      expect(payload.tasks_data[0]?.description).toContain("Etasje - 4");
      expect(payload.tasks_data[0]?.description).not.toContain("Heis - Ja");
    },
  );

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

  it("includes a GSM location on the pickup and return tasks when coordinates are stored", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "Pickup 1",
        pickupLatitude: 59.945,
        pickupLongitude: 10.7669,
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
        returnLatitude: 59.9,
        returnLongitude: 10.7,
      }),
    );

    const pickupTask = payload.tasks_data.find((task) => task.address.raw_address === "Pickup 1");
    const deliveryTask = payload.tasks_data.find((task) => task.address.raw_address === "Delivery 1");
    const returnTask = payload.tasks_data.find((task) => task.address.raw_address === "Return 1");

    expect(pickupTask?.address.location).toEqual({ type: "Point", coordinates: [10.7669, 59.945] });
    expect(returnTask?.address.location).toEqual({ type: "Point", coordinates: [10.7, 59.9] });
    // No coordinate given for delivery in this fixture — must not fabricate one.
    expect(deliveryTask?.address.location).toBeUndefined();
  });

  it("includes a GSM location on the delivery task when coordinates are stored", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        deliveryLatitude: 59.91,
        deliveryLongitude: 10.75,
        returnAddress: null,
      }),
    );

    const deliveryTask = payload.tasks_data.find((task) => task.address.raw_address === "Delivery 1");

    expect(deliveryTask?.address.location).toEqual({ type: "Point", coordinates: [10.75, 59.91] });
  });

  it("omits the GSM location when pickup/return coordinates are not stored", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "Pickup 1",
        pickupLatitude: null,
        pickupLongitude: null,
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
        returnLatitude: null,
        returnLongitude: null,
      }),
    );

    expect(payload.tasks_data.every((task) => task.address.location === undefined)).toBe(true);
  });

  it("includes a GSM location on extra pickup tasks using the matching extraPickupContacts entry", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "",
        extraPickupAddress: ["Pickup A", "Pickup B"],
        extraPickupContacts: [
          { address: "Pickup A", latitude: 60.1, longitude: 11.1 },
          { address: "Pickup B", latitude: null, longitude: null },
        ],
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
    );

    const taskA = payload.tasks_data.find((task) => task.address.raw_address === "Pickup A");
    const taskB = payload.tasks_data.find((task) => task.address.raw_address === "Pickup B");

    expect(taskA?.address.location).toEqual({ type: "Point", coordinates: [11.1, 60.1] });
    expect(taskB?.address.location).toBeUndefined();
  });

  it("matches extraPickupContacts entries by index even when an earlier placeholder pickup is omitted", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "",
        extraPickupAddress: ["No shop pickup address", "Pickup B"],
        extraPickupContacts: [
          { address: "No shop pickup address", latitude: null, longitude: null },
          { address: "Pickup B", latitude: 60.2, longitude: 11.2 },
        ],
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
    );

    const taskB = payload.tasks_data.find((task) => task.address.raw_address === "Pickup B");

    expect(taskB?.address.location).toEqual({ type: "Point", coordinates: [11.2, 60.2] });
  });

  it("uses canonical GSM text for return-to-store option codes", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload({
      ...buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        servicesSummary: "",
        driverInfo: "Ring kunden før levering",
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

    expect(payload.tasks_data[0]?.description).toContain(
      "- ❗Retur til butikk❗",
    );
    expect(payload.tasks_data[0]?.description).toContain(
      "Ring kunden før levering\n❗Retur til butikk❗",
    );
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
        returnAddress: "Recycling station 1",
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
    expect(payload.tasks_data.map((task) => task.address.raw_address)).toEqual([
      "Delivery 1",
      "Recycling station 1",
    ]);
    expect(payload.tasks_data[0]?.description).not.toContain(
      "Wrong saved return label",
    );
    expect(payload.tasks_data[0]?.description).not.toContain(
      "Wrong saved return description",
    );
  });

  it("omits WordPress KM price rows from the GSM description", () => {
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
          cardId: 99,
          productName: "WordPress order prices",
          itemType: "PRODUCT_CARD",
          deliveryType: null,
          rawData: {
            source: "wordpress_sync",
            readOnly: true,
          },
        }),
        buildOrderItem({
          id: "item-3",
          cardId: 99,
          productName: "WordPress order prices",
          itemType: "EXTRA_OPTION",
          deliveryType: null,
          optionLabel: "KM pris",
          rawData: {
            source: "wordpress_sync",
            readOnly: true,
            label: "KM pris",
          },
        }),
      ],
    });

    expect(payload.tasks_data[0]?.description).toContain("Washer");
    expect(payload.tasks_data[0]?.description).not.toContain("KM pris");
    expect(payload.tasks_data[0]?.description).not.toContain(
      "WordPress order prices",
    );
  });

  it("adds the Google review QR metafield only to the delivery task, not pickup or return tasks", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";
    process.env.GOOGLE_REVIEW_QR_URL = "https://otman.no/google-review-qr.png";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "Pickup 1",
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
      }),
    );

    expect(payload.tasks_data.map((task) => task.address.raw_address)).toEqual([
      "Pickup 1",
      "Delivery 1",
      "Return 1",
    ]);
    expect(payload.tasks_data[0]?.metafields?.["app:qr_link"]).toBeUndefined();
    expect(payload.tasks_data[1]?.metafields?.["app:qr_link"]).toBe(
      "https://otman.no/google-review-qr.png",
    );
    expect(payload.tasks_data[2]?.metafields?.["app:qr_link"]).toBeUndefined();
  });

  it("omits the Google review QR metafield entirely when GOOGLE_REVIEW_QR_URL is not configured", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";
    delete process.env.GOOGLE_REVIEW_QR_URL;

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "",
        deliveryAddress: "Delivery 1",
        returnAddress: null,
      }),
    );

    expect(payload.tasks_data[0]?.metafields?.["app:qr_link"]).toBeUndefined();
  });

  it("does not add the Google review QR metafield when the delivery leg is a return pickup, not an actual delivery", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";
    process.env.GOOGLE_REVIEW_QR_URL = "https://otman.no/google-review-qr.png";

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
    expect(payload.tasks_data[0]?.metafields?.["app:qr_link"]).toBeUndefined();
  });

  it("appends the warehouse phone to the pickup and return tasks, but not the delivery task", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "Pickup 1",
        customPickupAddressId: "cpa-1",
        customPickupAddressPhone: "22 33 44 55",
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
        customReturnAddressId: "cpa-2",
        customReturnAddressPhone: "+47 11 22 33 44",
      }),
    );

    const pickupTask = payload.tasks_data.find((task) => task.address.raw_address === "Pickup 1");
    const deliveryTask = payload.tasks_data.find((task) => task.address.raw_address === "Delivery 1");
    const returnTask = payload.tasks_data.find((task) => task.address.raw_address === "Return 1");

    expect(pickupTask?.description).toContain("Telefon lager: 22334455");
    expect(returnTask?.description).toContain("Telefon lager: +4711223344");
    expect(deliveryTask?.description).not.toContain("Telefon lager:");
  });

  it("does not append a warehouse phone line when the address wasn't a saved custom address", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "Pickup 1",
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
      }),
    );

    expect(payload.tasks_data.every((task) => !task.description.includes("Telefon lager:"))).toBe(true);
  });

  it("appends the warehouse phone to an extra pickup task resolved from a saved custom address", () => {
    process.env.GSM_ACCOUNT_URL = "https://gsm.example/accounts/1/";

    const payload = buildOrderPayload(
      buildOrder({
        pickupAddress: "",
        extraPickupAddress: ["Pickup A", "Pickup B"],
        extraPickupContacts: [
          { address: "Pickup A", customPickupAddressPhone: "22334455" },
          { address: "Pickup B", customPickupAddressPhone: null },
        ],
        deliveryAddress: "Delivery 1",
        returnAddress: null,
        servicesSummary: "",
      }),
    );

    const taskA = payload.tasks_data.find((task) => task.address.raw_address === "Pickup A");
    const taskB = payload.tasks_data.find((task) => task.address.raw_address === "Pickup B");

    expect(taskA?.description).toContain("Telefon lager: 22334455");
    expect(taskB?.description).not.toContain("Telefon lager:");
  });
});
