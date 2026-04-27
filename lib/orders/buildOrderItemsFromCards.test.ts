import { describe, expect, it } from "vitest";
import type {
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
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
});
