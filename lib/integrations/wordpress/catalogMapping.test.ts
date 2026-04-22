import { describe, expect, it } from "vitest";
import type {
  CatalogProduct,
  CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { mapWordpressImportToProductCards } from "@/lib/integrations/wordpress/catalogMapping";

const products: CatalogProduct[] = [
  {
    id: "product-1",
    code: "PRODUCT-1",
    label: "Vaskemaskin",
    active: true,
    productType: "LABOR",
    allowDeliveryTypes: true,
    allowInstallOptions: true,
    allowReturnOptions: true,
    allowExtraServices: true,
    allowDemont: true,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: false,
    autoXtraPerPallet: false,
    deliveryTypes: [],
    customSections: [],
    options: [
      {
        id: "install-1",
        code: "INSWASH1",
        label: "Option",
        description: null,
        category: "install",
        customerPrice: "0",
        subcontractorPrice: "0",
        effectiveCustomerPrice: "0",
        active: true,
      },
      {
        id: "demont-1",
        code: "DEMONT",
        label: "Demont",
        description: null,
        category: "return",
        customerPrice: "0",
        subcontractorPrice: "0",
        effectiveCustomerPrice: "0",
        active: true,
      },
    ],
  },
  {
    id: "product-2",
    code: "PRODUCT-2",
    label: "KjÃ¸leskap/ Kombiskap",
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
    deliveryTypes: [],
    customSections: [],
    options: [],
  },
  {
    id: "product-3",
    code: "PRODUCT-3",
    label: "Timepris",
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
    options: [
      {
        id: "labor-1",
        code: "MANNU1",
        label: "1 mann uten bil",
        description: null,
        category: "install",
        customerPrice: "450",
        subcontractorPrice: "0",
        effectiveCustomerPrice: "450",
        active: true,
      },
      {
        id: "labor-2",
        code: "MANNU2",
        label: "2 mann uten bil",
        description: null,
        category: "install",
        customerPrice: "850",
        subcontractorPrice: "0",
        effectiveCustomerPrice: "850",
        active: true,
      },
      {
        id: "labor-3",
        code: "MANN1",
        label: "1 mann med varebil",
        description: null,
        category: "install",
        customerPrice: "700",
        subcontractorPrice: "0",
        effectiveCustomerPrice: "700",
        active: true,
      },
      {
        id: "labor-4",
        code: "MANN2",
        label: "2 mann med varebil",
        description: null,
        category: "install",
        customerPrice: "1000",
        subcontractorPrice: "0",
        effectiveCustomerPrice: "1000",
        active: true,
      },
    ],
  },
];

const specialOptions: CatalogSpecialOption[] = [
  {
    id: "return-store",
    type: "return",
    code: "RETURNSTORE",
    label: "Return",
    description: "Retur til butikk",
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
  },
  {
    id: "unpacking",
    type: "extra_service",
    code: "UNPACKING",
    label: "Extra service",
    description: "Utpakking og kasting av emballasje",
    customerPrice: "0",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "0",
    active: true,
  },
];

describe("mapWordpressImportToProductCards", () => {
  it("maps wordpress product aliases, generic install labels, and return or extra services", () => {
    const result = mapWordpressImportToProductCards({
      parsedProducts: [
        {
          cardId: 1,
          productName: "Washing machine",
          quantity: 2,
          deliveryType: "Indoor carry",
        },
        {
          cardId: 2,
          productName: "Kombiskap",
          quantity: 1,
          deliveryType: "Kun retur",
        },
      ],
      parsedServices: [
        {
          cardId: 1,
          productName: "Washing machine",
          quantity: 2,
          itemType: "INSTALL_OPTION",
          label: "Install only",
          code: "INSTALLDOOR",
        },
        {
          cardId: 1,
          productName: "Washing machine",
          quantity: 2,
          itemType: "RETURN_OPTION",
          label: "Retur til butikk",
          code: "RETURNSTORE",
        },
        {
          cardId: 1,
          productName: "Washing machine",
          quantity: 2,
          itemType: "EXTRA_OPTION",
          label: "Demontering gamle vare",
          code: "DEMONT",
        },
        {
          cardId: 2,
          productName: "Kombiskap",
          quantity: 1,
          itemType: "EXTRA_OPTION",
          label: "Utpakking og kasting av emballasje",
          code: "UNPACKING",
        },
      ],
      catalogProducts: products,
      catalogSpecialOptions: specialOptions,
    });

    expect(result.unresolvedProducts).toEqual([]);
    expect(result.unresolvedServices).toEqual([]);
    expect(result.productCards).toEqual([
      expect.objectContaining({
        cardId: 1,
        productId: "product-1",
        amount: 2,
        deliveryType: "INDOOR",
        selectedInstallOptionIds: ["install-1"],
        selectedReturnOptionId: "return-store",
        demontEnabled: true,
      }),
      expect.objectContaining({
        cardId: 2,
        productId: "product-2",
        amount: 1,
        deliveryType: "RETURN_ONLY",
        selectedExtraOptionIds: ["unpacking"],
      }),
    ]);
    expect(result.resolvedServices).toEqual([
      expect.objectContaining({
        cardId: 1,
        resolvedItemType: "INSTALL_OPTION",
        optionCode: "INSWASH1",
      }),
      expect.objectContaining({
        cardId: 1,
        resolvedItemType: "RETURN_OPTION",
        optionCode: "RETURNSTORE",
      }),
      expect.objectContaining({
        cardId: 1,
        resolvedItemType: "EXTRA_OPTION",
        optionCode: "DEMONT",
      }),
      expect.objectContaining({
        cardId: 2,
        resolvedItemType: "EXTRA_OPTION",
        optionCode: "UNPACKING",
      }),
    ]);
  });

  it("returns unresolved products and services when no catalog mapping exists", () => {
    const result = mapWordpressImportToProductCards({
      parsedProducts: [
        {
          cardId: 1,
          productName: "Unknown product",
          quantity: 1,
          deliveryType: "Indoor carry",
        },
      ],
      parsedServices: [
        {
          cardId: 1,
          productName: "Unknown product",
          quantity: 1,
          itemType: "INSTALL_OPTION",
          label: "Unknown install",
          code: "UNKNOWN",
        },
      ],
      catalogProducts: products,
      catalogSpecialOptions: specialOptions,
    });

    expect(result.productCards).toEqual([]);
    expect(result.resolvedServices).toEqual([]);
    expect(result.unresolvedProducts).toHaveLength(1);
    expect(result.unresolvedServices).toHaveLength(1);
  });

  it("maps hourly wordpress products into hours input cards", () => {
    const result = mapWordpressImportToProductCards({
      parsedProducts: [
        {
          cardId: 3,
          productName: "timepris_flugger",
          quantity: 1,
          deliveryType: undefined,
        },
      ],
      parsedServices: [
        {
          cardId: 3,
          productName: "timepris_flugger",
          quantity: 0.5,
          itemType: "EXTRA_OPTION",
          label: "1 mann uten bil",
          code: "MANNU1",
        },
        {
          cardId: 3,
          productName: "timepris_flugger",
          quantity: 0.5,
          itemType: "EXTRA_OPTION",
          label: "2 mann uten bil",
          code: "MANNU2",
        },
        {
          cardId: 3,
          productName: "timepris_flugger",
          quantity: 0.5,
          itemType: "EXTRA_OPTION",
          label: "1 mann med varebil",
          code: "MANN1",
        },
        {
          cardId: 3,
          productName: "timepris_flugger",
          quantity: 0.5,
          itemType: "EXTRA_OPTION",
          label: "2 mann med varebil",
          code: "MANN2",
        },
      ],
      catalogProducts: products,
      catalogSpecialOptions: specialOptions,
    });

    expect(result.unresolvedProducts).toEqual([]);
    expect(result.unresolvedServices).toEqual([]);
    expect(result.productCards).toEqual([
      expect.objectContaining({
        cardId: 3,
        productId: "product-3",
        amount: 1,
        hoursInput: 0.5,
        selectedInstallOptionIds: ["labor-1", "labor-2", "labor-3", "labor-4"],
      }),
    ]);
  });

  it("keeps delivery type blank when wordpress only selected install and return services", () => {
    const result = mapWordpressImportToProductCards({
      parsedProducts: [
        {
          cardId: 4,
          productName: "Washing machine",
          quantity: 1,
          deliveryType: undefined,
        },
      ],
      parsedServices: [
        {
          cardId: 4,
          productName: "Washing machine",
          quantity: 1,
          itemType: "INSTALL_OPTION",
          label: "Install only",
          code: "INSTALLDOOR",
        },
        {
          cardId: 4,
          productName: "Washing machine",
          quantity: 1,
          itemType: "RETURN_OPTION",
          label: "Retur til butikk",
          code: "RETURNSTORE",
        },
      ],
      catalogProducts: products,
      catalogSpecialOptions: specialOptions,
    });

    expect(result.productCards).toEqual([
      expect.objectContaining({
        cardId: 4,
        deliveryType: "",
        selectedInstallOptionIds: ["install-1"],
        selectedReturnOptionId: "return-store",
      }),
    ]);
  });
});
