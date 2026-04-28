import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindFirstMock: vi.fn(),
  priceListFindUniqueMock: vi.fn(),
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
  orderAttachmentCreateManyMock: vi.fn(),
  orderAttachmentDeleteManyMock: vi.fn(),
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
    priceList: {
      findUnique: mocks.priceListFindUniqueMock,
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
    mocks.priceListFindUniqueMock.mockResolvedValue({
      id: "default-price-list-id",
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
    mocks.orderAttachmentCreateManyMock.mockResolvedValue({ count: 0 });
    mocks.orderAttachmentDeleteManyMock.mockResolvedValue({ count: 0 });
    mocks.getBookingCatalogMock.mockResolvedValue({
      products: [],
      specialOptions: [],
    });
    mocks.buildProductBreakdownsMock.mockReturnValue([]);
    mocks.buildPriceLookupMock.mockReturnValue(new Map());
    mocks.calculateBookingPricingMock.mockReturnValue({
      totals: {
        totalExVat: 0,
        subcontractorTotal: 0,
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
          orderAttachment: {
            createMany: typeof mocks.orderAttachmentCreateManyMock;
            deleteMany: typeof mocks.orderAttachmentDeleteManyMock;
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
          orderAttachment: {
            createMany: mocks.orderAttachmentCreateManyMock,
            deleteMany: mocks.orderAttachmentDeleteManyMock,
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
            field_684c3ad580b60: ["Express"],
            field_68248234acd3e: [
              { field_68248274acd3f: "Pickup 2" },
              { pickup: "Pickup 3" },
            ],
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
        expressDelivery: true,
        extraPickupAddress: ["Pickup 2", "Pickup 3"],
        extraPickupContacts: [
          {
            address: "Pickup 2",
            phone: "",
            email: "",
            sendEmail: true,
          },
          {
            address: "Pickup 3",
            phone: "",
            email: "",
            sendEmail: true,
          },
        ],
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

  it("imports explicit wordpress attachments onto created orders", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 10004,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Processing",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-10004",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
          },
          attachments: [
            {
              id: 42,
              filename: "receipt.pdf",
              mimeType: "application/pdf",
              sizeBytes: 12345,
              url: "https://wp.example.test/uploads/receipt.pdf",
              category: "RECEIPT",
            },
            {
              legacyAttachmentId: 43,
              filename: "",
              url: "https://wp.example.test/uploads/photo.jpg",
            },
            {
              legacyAttachmentId: 42,
              filename: "receipt-duplicate.pdf",
              url: "https://wp.example.test/uploads/receipt-duplicate.pdf",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderAttachmentDeleteManyMock).not.toHaveBeenCalled();
    expect(mocks.orderAttachmentCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: "order-1",
          legacyWordpressAttachmentId: 42,
          filename: "receipt.pdf",
          mimeType: "application/pdf",
          sizeBytes: 12345,
          storagePath: "https://wp.example.test/uploads/receipt.pdf",
          sourceUrl: "https://wp.example.test/uploads/receipt.pdf",
          source: "wordpress_import",
          category: "RECEIPT",
        }),
        expect.objectContaining({
          orderId: "order-1",
          legacyWordpressAttachmentId: 43,
          filename: "photo.jpg",
          mimeType: "image/jpeg",
          sizeBytes: null,
          storagePath: "https://wp.example.test/uploads/photo.jpg",
          sourceUrl: "https://wp.example.test/uploads/photo.jpg",
          source: "wordpress_import",
          category: "ATTACHMENT",
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("replaces wordpress-imported attachments when an existing order is re-synced", async () => {
    mocks.orderFindUniqueMock.mockResolvedValueOnce({
      id: "order-1",
      displayId: 20001,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 10005,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Processing",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-10005",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
          },
          attachments: [
            {
              legacyAttachmentId: 55,
              filename: "manual.png",
              url: "https://wp.example.test/uploads/manual.png",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderAttachmentDeleteManyMock).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        source: "wordpress_import",
      },
    });
    expect(mocks.orderAttachmentCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: "order-1",
          legacyWordpressAttachmentId: 55,
          filename: "manual.png",
          mimeType: "image/png",
          storagePath: "https://wp.example.test/uploads/manual.png",
          source: "wordpress_import",
        }),
      ],
      skipDuplicates: true,
    });
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

  it("normalizes wordpress deviations and discounts failed orders except protected fees", async () => {
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
          status: "failed",
          meta: {
            bestillingsnr: "PO-9994",
            kundens_navn: "WordPress Customer",
            field_682e0baebb080:
              "590:Avvik, bomtur; Kunde ikke hjemme:NOTHOME",
            price_breakdown_html: `
              <div class="price-breakdown-wrapper">
                <div class="price-breakdown-row">
                  <span class="price-breakdown-label"><strong>Avvik, bomtur; Kunde ikke hjemme (NOTHOME)</strong></span>
                  <span class="price-breakdown-price">590 NOK</span>
                </div>
                <div class="price-breakdown-row total-highlight">
                  <span class="price-breakdown-label"><strong>Total</strong></span>
                  <span class="price-breakdown-price">1590 NOK</span>
                </div>
              </div>
            `,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviation: "Deviation, missed trip; Customer not at home",
        rabatt: "1000",
        priceExVat: 590,
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
  });

  it("fills missing Andre produkter delivery type from the breakdown and keeps quantity-based cards at quantity 1", async () => {
    mocks.getBookingCatalogMock.mockResolvedValue({
      products: [
        {
          id: "dryer-product",
          code: "DRYER",
          label: "Torketrommel",
          active: true,
          productType: "PHYSICAL",
          allowDeliveryTypes: true,
          allowInstallOptions: true,
          allowReturnOptions: false,
          allowExtraServices: false,
          allowDemont: false,
          allowQuantity: true,
          allowPeopleCount: false,
          allowHoursInput: false,
          allowModelNumber: false,
          autoXtraPerPallet: false,
          deliveryTypes: [],
          customSections: [],
          options: [],
        },
        {
          id: "other-products-labor",
          code: "OTHER-LABOR",
          label: "Andre produkter",
          active: true,
          productType: "PHYSICAL",
          allowDeliveryTypes: false,
          allowInstallOptions: true,
          allowReturnOptions: false,
          allowExtraServices: false,
          allowDemont: false,
          allowQuantity: false,
          allowPeopleCount: false,
          allowHoursInput: true,
          allowModelNumber: false,
          autoXtraPerPallet: false,
          deliveryTypes: [],
          customSections: [],
          options: [],
        },
        {
          id: "other-products-delivery",
          code: "OTHER-DELIVERY",
          label: "Andre produkter",
          active: true,
          productType: "PHYSICAL",
          allowDeliveryTypes: true,
          allowInstallOptions: false,
          allowReturnOptions: false,
          allowExtraServices: false,
          allowDemont: false,
          allowQuantity: true,
          allowPeopleCount: false,
          allowHoursInput: false,
          allowModelNumber: false,
          autoXtraPerPallet: false,
          deliveryTypes: [],
          customSections: [],
          options: [],
        },
      ],
      specialOptions: [],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 9996,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-24 15:47:11",
          status: "confirmed",
          title: "Imported order",
          meta: {
            bestillingsnr: "11202499338",
            kundens_navn: "Roger Carson",
            pickup_address: "Power Alnabru, Smalvollveien 65, 0667 Oslo, Norge",
            delivery_address: "Trolldalsveien 25, 0672 Oslo, Norge",
            leveringsdato: "20260528",
            tidsvindu_for_levering: "16:00 - 21:00",
            extra_products_0_velg_produkt: "Torketrommel",
            extra_products_0_velg_leveringstype: "669:Innbaering:INDOOR",
            extra_products_0_antall_produkter: "1",
            extra_products_1_velg_produkt: "Andre produkter",
            extra_products_1_velg_leveringstype: "",
            extra_products_1_velg_leveringstype_andre:
              "229:Innbaering:XTRA",
            extra_products_1_antall_produkter: "1",
            price_breakdown_html: `
              <div class="price-breakdown-wrapper">
                <div class="price-group">
                  <div class="price-group-label"><strong>Torketrommel</strong></div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Innbaering (INDOOR)</span>
                    <span class="price-breakdown-price">669 NOK</span>
                  </div>
                </div>
                <div class="price-group">
                  <div class="price-group-label"><strong>Andre produkter</strong></div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Innbaering (XTRA)</span>
                    <span class="price-breakdown-price">229 NOK</span>
                  </div>
                </div>
              </div>
            `,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mapWordpressImportToProductCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedProducts: expect.arrayContaining([
          expect.objectContaining({
            cardId: 2,
            productName: "Andre produkter",
            deliveryType: "Innbaering",
            quantity: 1,
          }),
        ]),
      }),
    );
  });

  it("imports admin price adjustments into native totals and persisted fields", async () => {
    mocks.calculateBookingPricingMock.mockReturnValue({
      totals: {
        totalExVat: 12.5,
        subcontractorTotal: 7.5,
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
          legacyWordpressOrderId: 9996,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Processing",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-9996",
            kundens_navn: "WordPress Customer",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
            leveringsdato: "2026-04-25",
            field_686e217030aaa: "100 NOK",
            field_689db2aa4db4a: "50 NOK",
            field_6889f3e2ca127: `
              <div class="price-breakdown-wrapper">
                <div class="price-summary">
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label"><strong>Minus</strong></span>
                    <span class="price-breakdown-price">- 20 NOK</span>
                  </div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label"><strong>Ekstra</strong></span>
                    <span class="price-breakdown-price">+ 30 NOK</span>
                  </div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label"><strong>Total</strong></span>
                    <span class="price-breakdown-price">750 NOK</span>
                  </div>
                </div>
              </div>
            `,
            products_0_velg_produkt: "Washer",
            products_0_velg_leveringstype: "0:Indoor carry:INDOOR",
            products_0_antall_produkter: "1",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.calculateBookingPricingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        adjustments: {
          rabatt: "100",
          leggTil: undefined,
          subcontractorMinus: "20",
          subcontractorPlus: undefined,
        },
      }),
    );
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rabatt: "100",
        leggTil: undefined,
        subcontractorMinus: "20",
        subcontractorPlus: undefined,
        priceExVat: 13,
        priceSubcontractor: 8,
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
  });

  it("matches subcontractor total from wordpress when customer prices still use manual wordpress rows", async () => {
    mocks.calculateBookingPricingMock.mockImplementation((params: { adjustments?: { subcontractorMinus?: string; subcontractorPlus?: string } }) => {
      const subcontractorMinus = Number(params.adjustments?.subcontractorMinus ?? 0);
      const subcontractorPlus = Number(params.adjustments?.subcontractorPlus ?? 0);

      return {
        totals: {
          totalExVat: 0,
          subcontractorTotal: subcontractorPlus - subcontractorMinus,
        },
      };
    });

    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 10006,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Processing",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-10006",
            kundens_navn: "WordPress Customer",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
            leveringsdato: "2026-04-25",
            products_0_velg_produkt: "Washer",
            products_0_velg_leveringstype: "0:Indoor carry:INDOOR",
            products_0_antall_produkter: "1",
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
            field_6889f3e2ca127: `
              <div class="price-breakdown-wrapper">
                <div class="price-summary">
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label"><strong>Total</strong></span>
                    <span class="price-breakdown-price">125 NOK</span>
                  </div>
                </div>
              </div>
            `,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const createCall = mocks.orderCreateMock.mock.calls[0]?.[0];
    expect(createCall?.data).toEqual(
      expect.objectContaining({
        subcontractorPlus: "125",
        priceSubcontractor: 125,
      }),
    );
    expect(createCall?.data.productCardsSnapshot[0].wordpressImportReadOnly.comment).toContain(
      "Subcontractor price matched from WordPress",
    );
  });

  it("imports checkbox-style express and return selections when legacy meta stores truthy values instead of labels", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 9997,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Processing",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-9997",
            kundens_navn: "WordPress Customer",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
            leveringsdato: "2026-04-25",
            field_684c3ad580b60: 1,
            extra_products_0_velg_produkt: "Washer",
            extra_products_0_velg_leveringstype: "0:Indoor carry:INDOOR",
            extra_products_0_antall_produkter: "1",
            extra_products_0_field_682206a2252d2: 1,
            extra_products_0_montering_vaskemaskin: "1",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expressDelivery: true,
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
    expect(mocks.mapWordpressImportToProductCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedServices: expect.arrayContaining([
          expect.objectContaining({
            itemType: "RETURN_OPTION",
            label: "Retur til butikk",
            code: "RETURNSTORE",
          }),
          expect.objectContaining({
            itemType: "INSTALL_OPTION",
            label: "Montering",
          }),
        ]),
      }),
    );
  });

  it("imports discount values when wordpress stores them as arrays", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 9998,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Processing",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-9998",
            kundens_navn: "WordPress Customer",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
            leveringsdato: "2026-04-25",
            field_686e217030aaa: ["1780"],
            field_689db2aa4db4a: ["300"],
            extra_products_0_velg_produkt: "Washer",
            extra_products_0_velg_leveringstype: "0:Indoor carry:INDOOR",
            extra_products_0_antall_produkter: "1",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.calculateBookingPricingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        adjustments: expect.objectContaining({
          rabatt: "1780",
          leggTil: undefined,
        }),
      }),
    );
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rabatt: "1780",
        leggTil: undefined,
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
  });

  it("does not import KM pris as manual extra", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 10002,
          legacyWordpressUserId: 18,
          createdAt: "2026-04-24 16:23:00",
          status: "Behandles",
          title: "Imported order",
          meta: {
            bestillingsnr: "VV78V8Z",
            kundens_navn: "Grete Walborg Dokken Engebretsen",
            pickup_address: "POWER Strømmen, Støperiveien 5, 2010 Strømmen, Norway",
            delivery_address: "Veslefjellet 12, 2015 Leirsund, Norge",
            returadresse: "POWER Strømmen, Støperiveien 5, 2010 Strømmen, Norway",
            leveringsdato: "20260427",
            tidsvindu_for_levering: "16:00 - 21:00",
            total_km: "20.95",
            total_price: "1536",
            extra_products_0_velg_produkt: "Vaskemaskin",
            extra_products_0_velg_leveringstype: "669:Innbæring:INDOOR",
            extra_products_0_antall_produkter: "1",
            extra_products_0_retur: "250:Retur til gjenvinning:RETURNREC",
            extra_products_0_montering_av_vaskemaskin: [
              "590:Montering av vaskemaskin på våtrom:INSWASH1",
            ],
            extra_products_0_extra_pickup: "590:EXTRA PICKUP:EXTRAPICKUP",
            price_breakdown_html: `
              <div class="price-breakdown-wrapper">
                <div class="price-group">
                  <div class="price-group-label"><strong>Vaskemaskin</strong></div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Montering av vaskemaskin på våtrom (INSWASH1)</span>
                    <span class="price-breakdown-price">590 NOK</span>
                  </div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Retur til gjenvinning (RETURNREC)</span>
                    <span class="price-breakdown-price">250 NOK</span>
                  </div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Innbæring (INDOOR)</span>
                    <span class="price-breakdown-price">669 NOK</span>
                  </div>
                </div>
                <div class="price-breakdown-row">
                  <span class="price-breakdown-label"><strong>KM pris</strong></span>
                  <span class="price-breakdown-price">27 NOK</span>
                </div>
                <div class="price-breakdown-row">
                  <span class="price-breakdown-label"><strong>EXTRA PICKUP (EXTRAPICKUP) x1</strong></span>
                  <span class="price-breakdown-price">590 NOK</span>
                </div>
                <div class="price-summary">
                  <div class="price-breakdown-row total-highlight">
                    <span class="price-breakdown-label"><strong>Total</strong></span>
                    <span class="price-breakdown-price">1536.00 NOK</span>
                  </div>
                </div>
              </div>
            `,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leggTil: undefined,
        priceExVat: 1536,
        productCardsSnapshot: expect.arrayContaining([
          expect.objectContaining({
            wordpressImportReadOnly: expect.objectContaining({
              productName: "WordPress order prices",
              rows: expect.arrayContaining([
                expect.objectContaining({
                  label: expect.stringContaining("EXTRA PICKUP"),
                  priceCents: 59000,
                }),
                expect.objectContaining({
                  label: "KM pris",
                  priceCents: 2700,
                }),
              ]),
            }),
          }),
        ]),
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
    expect(mocks.mapWordpressImportToProductCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedServices: expect.not.arrayContaining([
          expect.objectContaining({
            code: "EXTRAPICKUP",
          }),
        ]),
      }),
    );
  });

  it("keeps extra pickup as a global wordpress price when it appears after a product group", async () => {
    mocks.calculateBookingPricingMock
      .mockReturnValueOnce({
        totals: {
          totalExVat: 1509,
          subcontractorTotal: 0,
        },
      })
      .mockReturnValue({
        totals: {
          totalExVat: 2099,
          subcontractorTotal: 0,
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
          legacyWordpressOrderId: 10012,
          legacyWordpressUserId: 18,
          status: "Bekreftet",
          meta: {
            bestillingsnr: "11340837253",
            kundens_navn: "Mathias Hollen",
            total_price: "2099",
            extra_pickup_locations: "1",
            extra_pickup_locations_0_pickup:
              "POWER Grunerlokka, Sannergata 2, 0557 Oslo, Norway",
            extra_products_0_velg_produkt: "Vaskemaskin",
            extra_products_0_velg_leveringstype: "669:Innbaring:INDOOR",
            extra_products_0_antall_produkter: "1",
            extra_products_0_retur: "250:Retur til gjenvinning:RETURNREC",
            extra_products_0_montering_av_vaskemaskin: [
              "590:Montering av vaskemaskin pa vatrom:INSWASH1",
            ],
            price_breakdown_html: `
              <div class="price-breakdown-wrapper">
                <div class="price-group">
                  <div class="price-group-label"><strong>Vaskemaskin</strong></div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Montering av vaskemaskin pa vatrom (INSWASH1)</span>
                    <span class="price-breakdown-price">590 NOK</span>
                  </div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Retur til gjenvinning (RETURNREC)</span>
                    <span class="price-breakdown-price">250 NOK</span>
                  </div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Innbaring (INDOOR)</span>
                    <span class="price-breakdown-price">669 NOK</span>
                  </div>
                </div>
                <div class="price-breakdown-row">
                  <span class="price-breakdown-label"><strong>EXTRA PICKUP (EXTRAPICKUP) x1</strong></span>
                  <span class="price-breakdown-price">590 NOK</span>
                </div>
                <hr>
                <div class="price-summary">
                  <div class="price-breakdown-row total-highlight">
                    <span class="price-breakdown-label"><strong>Total</strong></span>
                    <span class="price-breakdown-price">2099.00 NOK</span>
                  </div>
                </div>
              </div>
            `,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const createCall = mocks.orderCreateMock.mock.calls[0]?.[0];
    expect(createCall?.data).toEqual(
      expect.objectContaining({
        priceExVat: 2099,
        extraPickupAddress: [
          "POWER Grunerlokka, Sannergata 2, 0557 Oslo, Norway",
        ],
      }),
    );
    expect(createCall?.data.productCardsSnapshot[0]).toEqual(
      expect.objectContaining({
        productId: "product-1",
      }),
    );
    expect(
      createCall?.data.productCardsSnapshot[0].wordpressImportReadOnly,
    ).toBeUndefined();
    expect(createCall?.data.productCardsSnapshot[1]).toEqual(
      expect.objectContaining({
        wordpressImportReadOnly: expect.objectContaining({
          productName: "WordPress order prices",
          rows: expect.arrayContaining([
            expect.objectContaining({
              code: "EXTRAPICKUP",
              priceCents: 59000,
            }),
          ]),
        }),
      }),
    );
  });

  it("imports wordpress hardcoded order fees without mapping them as services", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 10003,
          legacyWordpressUserId: 18,
          createdAt: "2026-04-24 16:23:00",
          status: "Behandles",
          title: "Imported order",
          meta: {
            bestillingsnr: "FEE123",
            kundens_navn: "Fee Customer",
            pickup_address: "Pickup",
            delivery_address: "Delivery",
            leveringsdato: "20260427",
            field_68760a149a59b: ["Tillegg:XTRAARBEID"],
            field_68760ebfe7f33: "45",
            field_690216d860a13: ["Gebyr:ADDORDER"],
            extra_products_0_velg_produkt: "Washer",
            extra_products_0_velg_leveringstype: "0:Indoor carry:INDOOR",
            extra_products_0_antall_produkter: "1",
            price_breakdown_html: `
              <div class="price-breakdown-wrapper">
                <div class="price-group">
                  <div class="price-group-label"><strong>Washer</strong></div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Indoor carry (INDOOR)</span>
                    <span class="price-breakdown-price">100 NOK</span>
                  </div>
                </div>
                <div class="price-breakdown-row">
                  <span class="price-breakdown-label"><strong>Tillegg for ekstra arbeid per pÃ¥begynt 20 min x3 (XTRAARBEID)</strong></span>
                  <span class="price-breakdown-price">450 NOK</span>
                </div>
                <div class="price-breakdown-row">
                  <span class="price-breakdown-label"><strong>Gebyr for tillegg av bestilling (ADDORDER)</strong></span>
                  <span class="price-breakdown-price">99 NOK</span>
                </div>
              </div>
            `,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        feeExtraWork: true,
        extraWorkMinutes: 45,
        feeAddToOrder: true,
        priceExVat: 549,
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
    expect(mocks.mapWordpressImportToProductCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedServices: expect.not.arrayContaining([
          expect.objectContaining({
            code: "XTRAARBEID",
          }),
          expect.objectContaining({
            code: "ADDORDER",
          }),
        ]),
      }),
    );
  });

  it("imports manual discount, express, and return selection from the real wordpress payload shape", async () => {
    mocks.mapWordpressImportToProductCardsMock.mockReturnValueOnce({
      productCards: [
        {
          cardId: 1,
          productId: "product-1",
          modelNumber: "",
          deliveryType: "INDOOR",
          amount: 1,
          peopleCount: 1,
          hoursInput: 1,
          selectedInstallOptionIds: [],
          selectedExtraOptionIds: [],
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
          productName: "Vaskemaskin",
          quantity: 1,
          itemType: "RETURN_OPTION",
          label: "Retur til butikk",
          code: "RETURNSTORE",
          resolvedItemType: "RETURN_OPTION",
          optionId: "return-option-1",
          optionCode: "RETURNSTORE",
          optionLabel: "Return",
          customerPriceCents: 30000,
          subcontractorPriceCents: 20000,
        },
      ],
      unresolvedProducts: [],
      unresolvedServices: [],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 10000,
          legacyWordpressUserId: 31,
          createdAt: "2026-04-24 11:34:00",
          status: "Behandles",
          title: "TEST",
          meta: {
            express: ["Express"],
            total_price: "969",
            bestillingsnr: "TEST",
            leveringsdato: "29.04.2026",
            manual_discount: "500",
            price_breakdown_html: `
              <div class="price-breakdown-wrapper">
                <div class="price-group">
                  <div class="price-group-label"><strong>Vaskemaskin</strong></div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Retur til butikk (RETURNSTORE)</span>
                    <span class="price-breakdown-price">300 NOK</span>
                  </div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Innbæring (INDOOR)</span>
                    <span class="price-breakdown-price">669 NOK</span>
                  </div>
                </div>
                <div class="price-breakdown-row">
                  <span class="price-breakdown-label"><strong>EXPRESS DELIVERY (EXPRESS)</strong></span>
                  <span class="price-breakdown-price">500 NOK</span>
                </div>
                <div class="price-summary">
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label"><strong>Rabatt</strong></span>
                    <span class="price-breakdown-price">- 500.00 NOK</span>
                  </div>
                  <div class="price-breakdown-row total-highlight">
                    <span class="price-breakdown-label"><strong>Total</strong></span>
                    <span class="price-breakdown-price">969.00 NOK</span>
                  </div>
                </div>
              </div>
            `,
            extra_products_0_velg_produkt: "Vaskemaskin",
            extra_products_0_velg_leveringstype: "669:Innbæring:INDOOR",
            extra_products_0_antall_produkter: "1",
            extra_products_0_retur: "300:Retur til butikk:RETURNSTORE",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expressDelivery: true,
        rabatt: "500",
        priceExVat: 969,
        productCardsSnapshot: expect.arrayContaining([
          expect.objectContaining({
            selectedReturnOptionId: "return-option-1",
          }),
        ]),
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
  });

  it("forces return to store when a return address exists even if wordpress marked recycling", async () => {
    mocks.getBookingCatalogMock.mockResolvedValueOnce({
      products: [],
      specialOptions: [
        {
          id: "return-store-id",
          type: "return",
          code: "RETURNSTORE",
          label: "Retur til butikk",
          description: "Return to store",
          customerPrice: "300",
          subcontractorPrice: "200",
          effectiveCustomerPrice: "300",
          active: true,
        },
      ],
    });

    mocks.mapWordpressImportToProductCardsMock.mockReturnValueOnce({
      productCards: [
        {
          cardId: 1,
          productId: "product-1",
          modelNumber: "",
          deliveryType: "INDOOR",
          amount: 1,
          peopleCount: 1,
          hoursInput: 1,
          selectedInstallOptionIds: [],
          selectedExtraOptionIds: [],
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
          productName: "TV",
          quantity: 1,
          itemType: "RETURN_OPTION",
          label: "Retur til gjenvinning",
          code: "RETURNREC",
          resolvedItemType: "RETURN_OPTION",
          optionId: "return-rec-id",
          optionCode: "RETURNREC",
          optionLabel: "Recycling",
          customerPriceCents: 25000,
          subcontractorPriceCents: 15000,
        },
      ],
      unresolvedProducts: [],
      unresolvedServices: [],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 10001,
          legacyWordpressUserId: 31,
          createdAt: "2026-04-24 12:23:00",
          status: "Behandles",
          title: "TEST",
          meta: {
            bestillingsnr: "TEST",
            leveringsdato: "20260426",
            returadresse: "POWER Drammen, C O Lunds gate 25, 3043 Drammen, Norway",
            extra_products_0_velg_produkt: "TV",
            extra_products_0_velg_leveringstype: "229:Innbæring:XTRA",
            extra_products_0_antall_produkter: "1",
            extra_products_0_retur: "250:Retur til gjenvinning:RETURNREC",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mapWordpressImportToProductCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedServices: expect.arrayContaining([
          expect.objectContaining({
            cardId: 1,
            itemType: "RETURN_OPTION",
            label: "Retur til butikk",
            code: "RETURNSTORE",
          }),
        ]),
      }),
    );
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        returnAddress:
          "POWER Drammen, C O Lunds gate 25, 3043 Drammen, Norway",
        productCardsSnapshot: expect.arrayContaining([
          expect.objectContaining({
            cardId: 1,
            selectedReturnOptionId: "return-store-id",
          }),
        ]),
      }),
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
      },
    });
  });

  it("treats express rows in the breakdown as imported express delivery even without the checkbox field", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 9999,
          legacyWordpressUserId: 15,
          createdAt: "2026-04-22 06:30:00",
          status: "Processing",
          title: "Imported order",
          meta: {
            bestillingsnr: "PO-9999",
            kundens_navn: "WordPress Customer",
            pickup_address: "Pickup 1",
            delivery_address: "Delivery 1",
            leveringsdato: "2026-04-25",
            extra_products_0_velg_produkt: "Washer",
            extra_products_0_velg_leveringstype: "0:Indoor carry:INDOOR",
            extra_products_0_antall_produkter: "1",
            price_breakdown_html: `
              <div class="price-breakdown-wrapper">
                <div class="price-group">
                  <div class="price-group-label"><strong>Washer</strong></div>
                  <div class="price-breakdown-row">
                    <span class="price-breakdown-label">Indoor carry (INDOOR)</span>
                    <span class="price-breakdown-price">100 NOK</span>
                  </div>
                </div>
                <div class="price-breakdown-row">
                  <span class="price-breakdown-label"><strong>EXPRESS DELIVERY (EXPRESS)</strong></span>
                  <span class="price-breakdown-price">500 NOK</span>
                </div>
              </div>
            `,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.orderCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expressDelivery: true,
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
        subcontractorTotal: 0,
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
        zeroBaseDeliveryPricesOver100Km: false,
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

  it("reads the alternate delivery-type field for Andre produkter imports", async () => {
    mocks.mapWordpressImportToProductCardsMock.mockReturnValueOnce({
      productCards: [
        {
          cardId: 1,
          productId: "product-1",
          modelNumber: "",
          deliveryType: "INDOOR",
          amount: 1,
          peopleCount: 1,
          hoursInput: 1,
          selectedInstallOptionIds: [],
          selectedExtraOptionIds: [],
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
        {
          cardId: 2,
          productId: "product-2",
          modelNumber: "",
          deliveryType: "INDOOR",
          amount: 1,
          peopleCount: 1,
          hoursInput: 0.5,
          selectedInstallOptionIds: [],
          selectedExtraOptionIds: [],
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
      resolvedServices: [],
      unresolvedProducts: [],
      unresolvedServices: [],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/integrations/wordpress/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wp-sync-secret": "sync-secret",
        },
        body: JSON.stringify({
          legacyWordpressOrderId: 10003,
          legacyWordpressUserId: 31,
          createdAt: "2026-04-24 15:47:11",
          status: "confirmed",
          title: "11202499338",
          meta: {
            bestillingsnr: "11202499338",
            leveringsdato: "20260528",
            extra_products: ["main_produkt", "extra_produkt"],
            extra_products_0_velg_produkt: "Tørketrommel",
            extra_products_0_velg_leveringstype: "669:Innbæring:INDOOR",
            extra_products_0_antall_produkter: "1",
            extra_products_1_velg_produkt: "Andre produkter",
            extra_products_1_velg_leveringstype: "",
            extra_products_1_velg_leveringstype_andre: "229:Innbæring:XTRA",
            extra_products_1_antall_produkter: "1",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mapWordpressImportToProductCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedProducts: expect.arrayContaining([
          expect.objectContaining({
            cardId: 2,
            productName: "Andre produkter",
            deliveryType: "Innbæring",
          }),
        ]),
      }),
    );
  });
});
