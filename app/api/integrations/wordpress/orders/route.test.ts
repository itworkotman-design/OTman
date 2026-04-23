import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindFirstMock: vi.fn(),
  orderFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  companyOrderCounterUpsertMock: vi.fn(),
  companyOrderCounterUpdateMock: vi.fn(),
  orderCreateMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderNotificationFindFirstMock: vi.fn(),
  orderNotificationUpdateMock: vi.fn(),
  orderNotificationCountMock: vi.fn(),
  orderItemCreateManyMock: vi.fn(),
  orderItemDeleteManyMock: vi.fn(),
  getBookingCatalogMock: vi.fn(),
  buildProductBreakdownsMock: vi.fn(),
  buildPriceLookupMock: vi.fn(),
  calculateBookingPricingMock: vi.fn(),
  buildOrderItemsFromCardsMock: vi.fn(),
  mapWordpressImportToProductCardsMock: vi.fn(),
  createOrderNotificationMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    order: {
      findUnique: mocks.orderFindUniqueMock,
      update: mocks.orderUpdateMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/booking/catalog/getBookingCatalog", () => ({
  getBookingCatalog: mocks.getBookingCatalogMock,
}));

vi.mock("@/lib/booking/pricing/fromProductCards", () => ({
  buildProductBreakdowns: mocks.buildProductBreakdownsMock,
}));

vi.mock("@/lib/booking/pricing/priceLookup", () => ({
  buildPriceLookup: mocks.buildPriceLookupMock,
}));

vi.mock("@/lib/booking/pricing/engine", () => ({
  calculateBookingPricing: mocks.calculateBookingPricingMock,
}));

vi.mock("@/lib/orders/buildOrderItemsFromCards", () => ({
  buildOrderItemsFromCards: mocks.buildOrderItemsFromCardsMock,
}));

vi.mock("@/lib/integrations/wordpress/catalogMapping", () => ({
  mapWordpressImportToProductCards: mocks.mapWordpressImportToProductCardsMock,
}));

vi.mock("@/lib/orders/orderNotifications", () => ({
  createOrderNotification: mocks.createOrderNotificationMock,
}));

import { POST } from "./route";

describe("POST /api/integrations/wordpress/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORDPRESS_SYNC_SECRET = "sync-secret";
    process.env.WORDPRESS_SYNC_COMPANY_ID = "company-1";

    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      priceListId: "price-list-1",
    });
    mocks.orderFindUniqueMock.mockResolvedValue(null);
    mocks.companyOrderCounterUpsertMock.mockResolvedValue({
      nextNumber: 20001,
    });
    mocks.companyOrderCounterUpdateMock.mockResolvedValue(undefined);
    mocks.orderCreateMock.mockResolvedValue({
      id: "order-1",
      displayId: 20001,
      legacyWordpressOrderId: 9993,
    });
    mocks.orderUpdateMock.mockResolvedValue({
      id: "order-1",
      displayId: 20001,
      legacyWordpressOrderId: 9993,
    });
    mocks.orderNotificationFindFirstMock.mockResolvedValue(null);
    mocks.orderNotificationUpdateMock.mockResolvedValue(undefined);
    mocks.orderNotificationCountMock.mockResolvedValue(0);
    mocks.orderItemCreateManyMock.mockResolvedValue({ count: 3 });
    mocks.orderItemDeleteManyMock.mockResolvedValue({ count: 0 });
    mocks.getBookingCatalogMock.mockResolvedValue({
      products: [],
      specialOptions: [],
    });
    mocks.buildProductBreakdownsMock.mockReturnValue([]);
    mocks.buildPriceLookupMock.mockReturnValue(new Map());
    mocks.calculateBookingPricingMock.mockReturnValue({
      totals: {
        totalExVat: 0,
      },
    });
    mocks.createOrderNotificationMock.mockResolvedValue({
      id: "notification-1",
    });
    mocks.mapWordpressImportToProductCardsMock.mockReturnValue({
      productCards: [
        {
          cardId: 1,
          productId: "product-1",
          modelNumber: "",
          deliveryType: "INDOOR",
          amount: 2,
          peopleCount: 1,
          hoursInput: 1,
          selectedInstallOptionIds: ["install-option-1"],
          selectedExtraOptionIds: [],
          selectedReturnOptionId: "return-option-1",
          demontEnabled: false,
          selectedTimeOptionIds: [],
          extraTimeHours: 0.5,
          extraPalletEnabled: false,
          extraPalletQty: 1,
          etterEnabled: false,
          etterQty: 1,
          customSectionSelections: [],
        },
      ],
      resolvedServices: [
        {
          cardId: 1,
          productName: "Washer",
          quantity: 2,
          itemType: "INSTALL_OPTION",
          label: "Install only",
          code: "INSTALLDOOR",
          resolvedItemType: "INSTALL_OPTION",
          optionId: "install-option-1",
          optionCode: "INSWASH1",
          optionLabel: "Install washer",
          customerPriceCents: 0,
          subcontractorPriceCents: 0,
        },
        {
          cardId: 1,
          productName: "Washer",
          quantity: 2,
          itemType: "RETURN_OPTION",
          label: "Return to store",
          code: "RETURNSTORE",
          resolvedItemType: "RETURN_OPTION",
          optionId: "return-option-1",
          optionCode: "RETURNSTORE",
          optionLabel: "Return",
          customerPriceCents: 0,
          subcontractorPriceCents: 0,
        },
      ],
      unresolvedProducts: [],
      unresolvedServices: [],
    });
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([
      {
        cardId: 1,
        productId: "product-1",
        productCode: "PRODUCT-1",
        productName: "Vaskemaskin",
        deliveryType: "InnbÃ¦ring",
        itemType: "PRODUCT_CARD",
        optionId: null,
        optionCode: null,
        optionLabel: null,
        quantity: 2,
        customerPriceCents: null,
        subcontractorPriceCents: null,
        rawData: { productId: "product-1" },
      },
      {
        cardId: 1,
        productId: "product-1",
        productCode: "PRODUCT-1",
        productName: "Vaskemaskin",
        deliveryType: "InnbÃ¦ring",
        itemType: "INSTALL_OPTION",
        optionId: "install-option-1",
        optionCode: "INSWASH1",
        optionLabel: "Install washer",
        quantity: 2,
        customerPriceCents: 0,
        subcontractorPriceCents: 0,
        rawData: { code: "INSWASH1" },
      },
      {
        cardId: 1,
        productId: "product-1",
        productCode: "PRODUCT-1",
        productName: "Vaskemaskin",
        deliveryType: "InnbÃ¦ring",
        itemType: "RETURN_OPTION",
        optionId: "return-option-1",
        optionCode: "RETURNSTORE",
        optionLabel: "Return",
        quantity: 2,
        customerPriceCents: 0,
        subcontractorPriceCents: 0,
        rawData: { code: "RETURNSTORE" },
      },
    ]);
    mocks.transactionMock.mockImplementation(
      async (
        callback: (tx: {
          companyOrderCounter: {
            upsert: typeof mocks.companyOrderCounterUpsertMock;
            update: typeof mocks.companyOrderCounterUpdateMock;
          };
          order: {
            create: typeof mocks.orderCreateMock;
            update: typeof mocks.orderUpdateMock;
          };
          orderNotification: {
            findFirst: typeof mocks.orderNotificationFindFirstMock;
            update: typeof mocks.orderNotificationUpdateMock;
            count: typeof mocks.orderNotificationCountMock;
          };
          orderItem: {
            createMany: typeof mocks.orderItemCreateManyMock;
            deleteMany: typeof mocks.orderItemDeleteManyMock;
          };
        }) => Promise<unknown>,
      ) =>
        callback({
          companyOrderCounter: {
            upsert: mocks.companyOrderCounterUpsertMock,
            update: mocks.companyOrderCounterUpdateMock,
          },
          order: {
            create: mocks.orderCreateMock,
            update: mocks.orderUpdateMock,
          },
          orderNotification: {
            findFirst: mocks.orderNotificationFindFirstMock,
            update: mocks.orderNotificationUpdateMock,
            count: mocks.orderNotificationCountMock,
          },
          orderItem: {
            createMany: mocks.orderItemCreateManyMock,
            deleteMany: mocks.orderItemDeleteManyMock,
          },
        }),
    );
  });

  it("imports wordpress service labels into summaries and order items", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 9993,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Fail",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-9993",
            kundens_navn: "WordPress Customer",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
            leveringsdato: "20260425",
            tidsvindu_for_levering: "10:00 - 16:00",
            heis: "NEI",
            ekstra_kundens_telefon: "12 34 56 78",
            "e-postadresse": "wp@example.com",
            contact_notes: "Leave by the side door",
            etasje_nr: "4",
            kasserers_navn: "Cashier WP",
            kasserers_telefon: "90 12 34 56",
            extra_products_0_velg_produkt: "Washer",
            extra_products_0_velg_leveringstype: "0:Indoor carry:INDOOR",
            extra_products_0_antall_produkter: "2",
            extra_products_0_montering_vaskemaskin: [
              "399:Install only:INSTALLDOOR",
            ],
            extra_products_0_retur: "200:Return to store:RETURNSTORE",
            price_breakdown_html: `
              <div class="price-breakdown-wrapper">
                <div class="price-group">
                  <div class="price-group-label"><strong>Washer</strong></div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Indoor carry (INDOOR)</span>
                    <span class="price-breakdown-price">100 NOK</span>
                  </div>
                </div>
              </div>
            `,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      order: {
        id: "order-1",
        displayId: 20001,
        legacyWordpressOrderId: 9993,
      },
      importedItemCount: 3,
    });

    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        createdByMembershipId: "membership-1",
        customerMembershipId: "membership-1",
        priceListId: "price-list-1",
        legacyWordpressOrderId: 9993,
        legacyWordpressAuthorId: 15,
        customerLabel: "WordPress Customer",
        customerName: "WordPress Customer",
        pickupAddress: "Pickup 1",
        deliveryAddress: "Delivery 1",
        phoneTwo: "12 34 56 78",
        email: "wp@example.com",
        customerComments: "Leave by the side door",
        floorNo: "4",
        lift: "no",
        cashierName: "Cashier WP",
        cashierPhone: "90 12 34 56",
        deliveryDate: "2026-04-25",
        timeWindow: "10:00-16:00",
        status: "failed",
        productCardsSnapshot: expect.any(Array),
        deliveryTypeSummary: "Indoor carry",
        servicesSummary: "Install only x2, Return to store x2",
        drivingDistance: undefined,
        priceExVat: 0,
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });

    expect(mocks.orderItemCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          cardId: 1,
          productId: "product-1",
          itemType: "PRODUCT_CARD",
          productName: "Vaskemaskin",
          deliveryType: "InnbÃ¦ring",
          quantity: 2,
          rawData: expect.objectContaining({
            source: "wordpress_sync",
            installLabels: ["Install only"],
            returnLabels: ["Return to store"],
          }),
        }),
        expect.objectContaining({
          cardId: 1,
          productId: "product-1",
          itemType: "INSTALL_OPTION",
          optionCode: "INSWASH1",
          optionLabel: "Install washer",
          quantity: 2,
          rawData: expect.objectContaining({
            source: "wordpress_sync",
            label: "Install only",
            code: "INSTALLDOOR",
            mappedOptionCode: "INSWASH1",
          }),
        }),
        expect.objectContaining({
          cardId: 1,
          productId: "product-1",
          itemType: "RETURN_OPTION",
          optionCode: "RETURNSTORE",
          optionLabel: "Return",
          quantity: 2,
          rawData: expect.objectContaining({
            source: "wordpress_sync",
            label: "Return to store",
            code: "RETURNSTORE",
            mappedOptionCode: "RETURNSTORE",
          }),
        }),
      ],
    });
    expect(mocks.mapWordpressImportToProductCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedServices: expect.arrayContaining([
          expect.objectContaining({
            itemType: "INSTALL_OPTION",
            label: "Install only",
            code: "INSTALLDOOR",
          }),
          expect.objectContaining({
            itemType: "RETURN_OPTION",
            label: "Return to store",
            code: "RETURNSTORE",
          }),
        ]),
      }),
    );
    expect(mocks.createOrderNotificationMock).not.toHaveBeenCalled();
  });

  it("creates supplemental extra rows when a mapped wordpress service is not emitted by the native builder", async () => {
    mocks.mapWordpressImportToProductCardsMock.mockReturnValue({
      productCards: [
        {
          cardId: 1,
          productId: "product-1",
          modelNumber: "",
          deliveryType: "INDOOR",
          amount: 2,
          peopleCount: 1,
          hoursInput: 1,
          selectedInstallOptionIds: ["install-option-1"],
          selectedExtraOptionIds: ["extra-option-1"],
          selectedReturnOptionId: null,
          demontEnabled: false,
          selectedTimeOptionIds: [],
          extraTimeHours: 0.5,
          extraPalletEnabled: false,
          extraPalletQty: 1,
          etterEnabled: false,
          etterQty: 1,
          customSectionSelections: [],
        },
      ],
      resolvedServices: [
        {
          cardId: 1,
          productName: "Washer",
          quantity: 2,
          itemType: "INSTALL_OPTION",
          label: "Install only",
          code: "INSTALLDOOR",
          resolvedItemType: "INSTALL_OPTION",
          optionId: "install-option-1",
          optionCode: "INSWASH1",
          optionLabel: "Install washer",
          customerPriceCents: 0,
          subcontractorPriceCents: 0,
        },
        {
          cardId: 1,
          productName: "Washer",
          quantity: 2,
          itemType: "EXTRA_OPTION",
          label: "Utpakking og kasting av emballasje",
          code: "UNPACKING",
          resolvedItemType: "EXTRA_OPTION",
          optionId: "extra-option-1",
          optionCode: "UNPACKING",
          optionLabel: "Extra service",
          customerPriceCents: 0,
          subcontractorPriceCents: 0,
        },
      ],
      unresolvedProducts: [],
      unresolvedServices: [],
    });
    mocks.orderItemCreateManyMock.mockResolvedValue({ count: 3 });
    mocks.buildOrderItemsFromCardsMock.mockReturnValue([
      {
        cardId: 1,
        productId: "product-1",
        productCode: "PRODUCT-1",
        productName: "Vaskemaskin",
        deliveryType: "InnbÃ¦ring",
        itemType: "PRODUCT_CARD",
        optionId: null,
        optionCode: null,
        optionLabel: null,
        quantity: 2,
        customerPriceCents: null,
        subcontractorPriceCents: null,
        rawData: { productId: "product-1" },
      },
      {
        cardId: 1,
        productId: "product-1",
        productCode: "PRODUCT-1",
        productName: "Vaskemaskin",
        deliveryType: "InnbÃ¦ring",
        itemType: "INSTALL_OPTION",
        optionId: "install-option-1",
        optionCode: "INSWASH1",
        optionLabel: "Install washer",
        quantity: 2,
        customerPriceCents: 0,
        subcontractorPriceCents: 0,
        rawData: { code: "INSWASH1" },
      },
    ]);

    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 9994,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Processing",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-9994",
            kundens_navn: "WordPress Customer",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
            leveringsdato: "2026-04-25",
            tidsvindu_for_levering: "08:00 - 12:00",
            products_0_velg_produkt: "Washer",
            products_0_velg_leveringstype: "0:Indoor carry:INDOOR",
            products_0_antall_produkter: "2",
            price_breakdown_html: `
              <div class="price-breakdown-wrapper">
                <div class="price-group">
                  <div class="price-group-label"><strong>Washer</strong></div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Indoor carry (INDOOR)</span>
                    <span class="price-breakdown-price">100 NOK</span>
                  </div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Install only (INSTALLDOOR)</span>
                    <span class="price-breakdown-price">399 NOK</span>
                  </div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Utpakking og kasting av emballasje (UNPACKING)</span>
                    <span class="price-breakdown-price">200 NOK</span>
                  </div>
                </div>
              </div>
            `,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      order: {
        id: "order-1",
        displayId: 20001,
        legacyWordpressOrderId: 9993,
      },
      importedItemCount: 3,
    });

    expect(mocks.orderItemCreateManyMock).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          itemType: "EXTRA_OPTION",
          optionCode: "UNPACKING",
          optionLabel: "Extra service",
          rawData: expect.objectContaining({
            source: "wordpress_sync",
            label: "Utpakking og kasting av emballasje",
            code: "UNPACKING",
            mappedOptionCode: "UNPACKING",
          }),
        }),
      ]),
    });
    expect(mocks.mapWordpressImportToProductCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedProducts: [
          expect.objectContaining({
            cardId: 1,
            productName: "Washer",
            quantity: 2,
            deliveryType: "Indoor carry",
          }),
        ],
      }),
    );
    expect(mocks.createOrderNotificationMock).not.toHaveBeenCalled();
  });

  it("prefers legacy order_status meta and normalizes fail to failed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 9994,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "publish",
          title: "Imported order",
          meta: {
            order_status: "Fail",
            bestillingsnr: "PO-9994",
            kundens_navn: "WordPress Customer",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
            leveringsdato: "20260425",
            extra_products_0_velg_produkt: "Washer",
            extra_products_0_antall_produkter: "1",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "failed",
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
  });

  it("creates a manual-review alert when the imported wordpress total mismatches the rebuilt native total", async () => {
    mocks.calculateBookingPricingMock.mockReturnValue({
      totals: {
        totalExVat: 25,
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 9995,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Processing",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-9995",
            kundens_navn: "WordPress Customer",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
            leveringsdato: "2026-04-25",
            tidsvindu_for_levering: "08:00 - 12:00",
            total_km: "125 km",
            total_price: 10000,
            products_0_velg_produkt: "Washer",
            products_0_velg_leveringstype: "0:Side by side:SIDEBYSIDE",
            products_0_antall_produkter: "1",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "processing",
        drivingDistance: "125 km",
        priceExVat: 10000,
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
    expect(mocks.buildProductBreakdownsMock).toHaveBeenCalledWith(
      expect.any(Array),
      [],
      [],
      {
        zeroBaseDeliveryPricesOver100Km: true,
      },
    );
    expect(mocks.createOrderNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({
          create: mocks.orderCreateMock,
        }),
      }),
      {
        orderId: "order-1",
        companyId: "company-1",
        type: "MANUAL_REVIEW",
        title: "WordPress price mismatch",
        message:
          "Imported WordPress price does not match the rebuilt native total. Review the order manually.",
        payload: {
          source: "wordpress_import",
          wordpressPriceExVatCents: 1000000,
          nativePriceExVatCents: 2500,
        },
      },
    );
  });
});
