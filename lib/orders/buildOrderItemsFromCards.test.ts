import { describe, expect, it } from "vitest";
import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { buildOrderItemsFromCards } from "./buildOrderItemsFromCards";

function buildProduct(): CatalogProduct {
  return {
    id: "product-1",
    code: "PROD-1",
    label: "Washer",
    active: true,
    productType: "PHYSICAL",
    allowDeliveryTypes: false,
    allowInstallOptions: true,
    allowReturnOptions: false,
    allowExtraServices: false,
    allowDemont: false,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: true,
    autoXtraPerPallet: false,
    deliveryTypes: [],
    customSections: [],
    options: [
      {
        id: "install-1",
        code: "INSTALL",
        label: "Install",
        description: "Install",
        category: "install",
        customerPrice: "500",
        subcontractorPrice: "200",
        effectiveCustomerPrice: "350",
        active: true,
      },
    ],
  };
}

function buildCard(): SavedProductCard {
  return {
    cardId: 0,
    productId: "product-1",
    modelNumber: "",
    deliveryType: "",
    amount: 2,
    peopleCount: 1,
    hoursInput: 1,
    selectedInstallOptionIds: ["install-1"],
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
  };
}

const specialOptions: CatalogSpecialOption[] = [
  {
    id: "return-store",
    type: "return",
    code: "RETURNSTORE",
    label: "Return",
    description: "Retur til butikk",
    customerPrice: "300",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "300",
    active: true,
  },
  {
    id: "xtra-indoor",
    type: "xtra",
    code: "XTRA",
    label: "XTRA",
    description: "Ekstra innbæring",
    customerPrice: "229",
    subcontractorPrice: "100",
    effectiveCustomerPrice: "229",
    active: true,
  },
];

describe("buildOrderItemsFromCards", () => {
  it("stores read-only WordPress mismatch rows with their original prices", () => {
    const items = buildOrderItemsFromCards(
      [
        {
          ...buildCard(),
          productId: null,
          wordpressImportReadOnly: {
            productName: "WP Washer",
            comment: "New system was unable to match to old price",
            subcontractorRows: [
              {
                label: "EXTRA PICKUP",
                code: "EXTRAPICKUP",
                quantity: 1,
                priceCents: 39000,
              },
            ],
            rows: [
              {
                label: "EXTRA PICKUP",
                code: "EXTRAPICKUP",
                quantity: 1,
                priceCents: 59000,
              },
            ],
          },
        },
      ],
      [buildProduct()],
      [],
    );

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "PRODUCT_CARD",
          productName: "WP Washer",
          rawData: expect.objectContaining({
            readOnly: true,
          }),
        }),
        expect.objectContaining({
          itemType: "EXTRA_OPTION",
          optionCode: "EXTRAPICKUP",
          optionLabel: "EXTRA PICKUP",
          customerPriceCents: 59000,
          subcontractorPriceCents: 39000,
        }),
      ]),
    );
  });

  it("stores read-only WordPress multiplied rows with quantity and unit price", () => {
    const items = buildOrderItemsFromCards(
      [
        {
          ...buildCard(),
          productId: null,
          wordpressImportReadOnly: {
            productName: "WP Dishwasher",
            comment: "New system was unable to match to old price",
            rows: [
              {
                label: "Oppvaskmaskin installasjon",
                code: "INSDISHW2",
                quantity: 4,
                priceCents: 224900,
              },
            ],
          },
        },
      ],
      [buildProduct()],
      [],
    );

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "EXTRA_OPTION",
          optionCode: "INSDISHW2",
          quantity: 4,
          customerPriceCents: 224900,
        }),
      ]),
    );
  });

  it("stores discounted effective customer prices on order items", () => {
    const items = buildOrderItemsFromCards([buildCard()], [buildProduct()], []);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "INSTALL_OPTION",
          optionId: "install-1",
          customerPriceCents: 35000,
          subcontractorPriceCents: 20000,
        }),
      ]),
    );
  });

  it("stores enabled product auto delivery prices on order items", () => {
    const items = buildOrderItemsFromCards(
      [buildCard()],
      [
        {
          ...buildProduct(),
          autoDeliveryPrice: {
            enabled: true,
            code: "AUTO_START",
            label: "Startup delivery",
            price: "125",
            subcontractorPrice: "50",
            includeInXtraLogic: false,
          },
        },
      ],
      [],
    );

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "EXTRA_OPTION",
          optionCode: "AUTO_START",
          optionLabel: "Startup delivery",
          quantity: 1,
          customerPriceCents: 12500,
          subcontractorPriceCents: 5000,
          rawData: expect.objectContaining({
            source: "auto_delivery_price",
          }),
        }),
      ]),
    );
  });

  it("keeps return options on install-only cards but not on first-step cards", () => {
    const items = buildOrderItemsFromCards(
      [
        {
          ...buildCard(),
          cardId: 1,
          deliveryType: DELIVERY_TYPES.INSTALL_ONLY,
          selectedReturnOptionId: "return-store",
        },
        {
          ...buildCard(),
          cardId: 2,
          deliveryType: DELIVERY_TYPES.FIRST_STEP,
          selectedReturnOptionId: "return-store",
        },
      ],
      [
        {
          ...buildProduct(),
          allowDeliveryTypes: true,
          allowReturnOptions: true,
        },
      ],
      specialOptions,
    );

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: 1,
          itemType: "RETURN_OPTION",
          optionId: "return-store",
        }),
      ]),
    );
    expect(items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: 2,
          itemType: "RETURN_OPTION",
          optionId: "return-store",
        }),
      ]),
    );
  });

  it("replaces configured auto delivery price with XTRA on XTRA cards", () => {
    const items = buildOrderItemsFromCards(
      [
        {
          ...buildCard(),
          cardId: 1,
          deliveryType: DELIVERY_TYPES.INDOOR,
        },
        {
          ...buildCard(),
          cardId: 2,
          productId: "product-2",
        },
      ],
      [
        {
          ...buildProduct(),
          allowDeliveryTypes: true,
          deliveryTypes: [
            {
              key: DELIVERY_TYPES.INDOOR,
              enabled: true,
              code: "INDOOR",
              label: "Innbæring",
              price: "669",
              subcontractorPrice: "350",
              xtraPrice: "229",
              xtraSubcontractorPrice: "100",
              allowInstallOptions: true,
              allowExtraServices: true,
              allowReturnOptions: true,
              allowModelNumber: false,
            },
          ],
        },
        {
          ...buildProduct(),
          id: "product-2",
          code: "PROD-2",
          label: "Ettermontering",
          allowDeliveryTypes: false,
          autoDeliveryPrice: {
            enabled: true,
            code: "AUTO_START",
            label: "Startup delivery",
            price: "590",
            subcontractorPrice: "250",
            includeInXtraLogic: true,
          },
        },
      ],
      specialOptions,
    );

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: 2,
          itemType: "EXTRA_OPTION",
          optionId: "xtra-indoor",
          optionCode: "XTRA",
          customerPriceCents: 22900,
          subcontractorPriceCents: 10000,
          rawData: expect.objectContaining({
            source: "auto_delivery_price_xtra",
          }),
        }),
      ]),
    );
    expect(items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: 2,
          optionCode: "AUTO_START",
        }),
      ]),
    );
  });
});
