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
  {
    id: "product-4",
    code: "PRODUCT-4",
    label: "Side by side",
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
    customSections: [
      {
        id: "custom-return-section",
        title: "Return services",
        usePrices: true,
        allowMultiple: false,
        options: [
          {
            id: "custom-return-option",
            code: "SBSRETURN",
            label: "Hardcoded return",
            price: "499",
          },
        ],
      },
    ],
    options: [
      {
        id: "install-sbs-1",
        code: "INSSBS1",
        label: "Install side by side",
        description: null,
        category: "install",
        customerPrice: "0",
        subcontractorPrice: "0",
        effectiveCustomerPrice: "0",
        active: true,
      },
      {
        id: "install-sbs-2",
        code: "INSSBS2",
        label: "Install side by side with water connection",
        description: null,
        category: "install",
        customerPrice: "0",
        subcontractorPrice: "0",
        effectiveCustomerPrice: "0",
        active: true,
      },
    ],
  },
];

const duplicateOtherProducts: CatalogProduct[] = [
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

  it("maps return options by exact price when labels and codes do not match", () => {
    const result = mapWordpressImportToProductCards({
      parsedProducts: [
        {
          cardId: 8,
          productName: "Washing machine",
          quantity: 1,
          deliveryType: "Indoor carry",
        },
      ],
      parsedServices: [
        {
          cardId: 8,
          productName: "Washing machine",
          quantity: 1,
          itemType: "RETURN_OPTION",
          label: "Old WP return label",
          code: "OLDRETURN",
          priceCents: 25000,
        },
      ],
      catalogProducts: products,
      catalogSpecialOptions: [
        {
          id: "return-price-match",
          type: "return",
          code: "NEWRETURN",
          label: "New return label",
          description: "New return label",
          customerPrice: "250",
          subcontractorPrice: "0",
          effectiveCustomerPrice: "250",
          active: true,
        },
      ],
    });

    expect(result.unresolvedServices).toEqual([]);
    expect(result.productCards).toEqual([
      expect.objectContaining({
        cardId: 8,
        selectedReturnOptionId: "return-price-match",
      }),
    ]);
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
        amount: 0.5,
        hoursInput: 0.5,
        selectedInstallOptionIds: ["labor-1", "labor-2", "labor-3", "labor-4"],
      }),
    ]);
  });

  it("infers delivery type from wordpress install and return services when the product row has no explicit delivery type", () => {
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
        deliveryType: "INSTALL_ONLY",
        selectedInstallOptionIds: ["install-1"],
        selectedReturnOptionId: "return-store",
      }),
    ]);
  });

  it("does not map non-install legacy services onto install selections through generic aliases", () => {
    const result = mapWordpressImportToProductCards({
      parsedProducts: [
        {
          cardId: 6,
          productName: "Washing machine",
          quantity: 1,
          deliveryType: "Indoor carry",
        },
      ],
      parsedServices: [
        {
          cardId: 6,
          productName: "Washing machine",
          quantity: 1,
          itemType: "EXTRA_OPTION",
          label: "Montering",
          code: undefined,
        },
      ],
      catalogProducts: products,
      catalogSpecialOptions: specialOptions,
    });

    expect(result.productCards).toEqual([
      expect.objectContaining({
        cardId: 6,
        productId: "product-1",
        deliveryType: "INDOOR",
        selectedInstallOptionIds: [],
      }),
    ]);
    expect(result.resolvedServices).toEqual([]);
    expect(result.unresolvedServices).toEqual([
      expect.objectContaining({
        cardId: 6,
        itemType: "EXTRA_OPTION",
        label: "Montering",
      }),
    ]);
  });

  it("prefers a delivery-capable Andre produkter product when wordpress provides a delivery type", () => {
    const result = mapWordpressImportToProductCards({
      parsedProducts: [
        {
          cardId: 7,
          productName: "Andre produkter",
          quantity: 1,
          deliveryType: "Innbæring",
        },
      ],
      parsedServices: [],
      catalogProducts: duplicateOtherProducts,
      catalogSpecialOptions: [],
    });

    expect(result.productCards).toEqual([
      expect.objectContaining({
        cardId: 7,
        productId: "other-products-delivery",
        deliveryType: "INDOOR",
        amount: 1,
        hoursInput: 1,
      }),
    ]);
  });

  it("matches side-by-side install codes directly and resolves hardcoded side-by-side return codes through the code checker", () => {
    const result = mapWordpressImportToProductCards({
      parsedProducts: [
        {
          cardId: 5,
          productName: "Side by side",
          quantity: 1,
          deliveryType: "Side by side",
        },
      ],
      parsedServices: [
        {
          cardId: 5,
          productName: "Side by side",
          quantity: 1,
          itemType: "INSTALL_OPTION",
          label: "Montering av SBS uten vanntilkobling",
          code: "INSSBS1",
        },
        {
          cardId: 5,
          productName: "Side by side",
          quantity: 1,
          itemType: "INSTALL_OPTION",
          label: "Montering av SBS til godkjent vanntilkobling",
          code: "INSSBS2",
        },
        {
          cardId: 5,
          productName: "Side by side",
          quantity: 1,
          itemType: "RETURN_OPTION",
          label: "Retur av SBS til butikk",
          code: "RETURNSBSSTORE",
        },
      ],
      catalogProducts: products,
      catalogSpecialOptions: specialOptions,
    });

    expect(result.unresolvedProducts).toEqual([]);
    expect(result.unresolvedServices).toEqual([]);
    expect(result.productCards).toEqual([
      expect.objectContaining({
        cardId: 5,
        productId: "product-4",
        deliveryType: "FIRST_STEP",
        selectedInstallOptionIds: ["install-sbs-1", "install-sbs-2"],
        customSectionSelections: [
          {
            sectionId: "custom-return-section",
            optionIds: ["custom-return-option"],
          },
        ],
      }),
    ]);
    expect(result.resolvedServices).toEqual([
      expect.objectContaining({
        cardId: 5,
        resolvedItemType: "INSTALL_OPTION",
        optionCode: "INSSBS1",
        optionId: "install-sbs-1",
      }),
      expect.objectContaining({
        cardId: 5,
        resolvedItemType: "INSTALL_OPTION",
        optionCode: "INSSBS2",
        optionId: "install-sbs-2",
      }),
      expect.objectContaining({
        cardId: 5,
        resolvedItemType: "EXTRA_OPTION",
        optionCode: "SBSRETURN",
        optionId: "custom-return-option",
        customSectionId: "custom-return-section",
      }),
    ]);
  });
});
