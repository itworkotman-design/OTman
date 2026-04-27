import { describe, expect, it } from "vitest";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

function buildProduct(overrides?: Partial<CatalogProduct>): CatalogProduct {
  return {
    id: "product-1",
    code: "PROD-1",
    label: "Seng",
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
    allowModelNumber: true,
    autoXtraPerPallet: false,
    deliveryTypes: createDefaultProductDeliveryTypes(),
    customSections: [],
    options: [
      {
        id: "install-1",
        code: "INSTALL",
        label: "Montering",
        description: "Montering",
        category: "install",
        customerPrice: "300",
        subcontractorPrice: "100",
        effectiveCustomerPrice: "300",
        active: true,
      },
    ],
    ...overrides,
  };
}

function buildCard(overrides: Partial<SavedProductCard>): SavedProductCard {
  return {
    cardId: 0,
    productId: "product-1",
    modelNumber: "",
    deliveryType: "",
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
    ...overrides,
  };
}

const returnOptions: CatalogSpecialOption[] = [
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
];

const automaticXtraOptions: CatalogSpecialOption[] = [
  {
    id: "xtra-indoor",
    type: "xtra",
    code: "XTRA",
    label: "XTRA",
    description: "Ekstra innbæring",
    customerPrice: "229",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "229",
    active: true,
  },
  {
    id: "xtra-first-step",
    type: "xtra",
    code: "XTRAFIRST",
    label: "XTRA",
    description: "Ekstra levering",
    customerPrice: "150",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "150",
    active: true,
  },
];

describe("buildProductBreakdowns", () => {
  it("keeps WordPress price mismatches as read-only custom price rows", () => {
    const result = buildProductBreakdowns(
      [
        buildCard({
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
        }),
      ],
      [buildProduct()],
      [],
    );

    expect(result).toEqual([
      {
        productName: "WP Washer",
        readOnly: true,
        comment: "New system was unable to match to old price",
        items: [
          {
            kind: "customPrice",
            code: "EXTRAPICKUP",
            label: "EXTRA PICKUP",
            qty: 1,
            unitPrice: 590,
            subcontractorUnitPrice: 0,
          },
        ],
      },
    ]);
  });

  it("uses standard and XTRA indoor delivery display values", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "INDOOR",
      unitPrice: 669,
      label: "Innbæring",
    });
    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "XTRA",
      unitPrice: 229,
      label: "Innbæring",
    });
  });

  it("uses XTRA first-step pricing after an earlier selected product", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.FIRST_STEP,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "XTRA",
      unitPrice: 150,
      label: "Første trinn",
    });
  });

  it("keeps the first selected product at full price and makes later indoor products XTRA", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 3,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      unitPrice: 669,
      label: "Innbæring",
    });
    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "XTRA",
      unitPrice: 229,
      label: "Innbæring",
    });
    expect(result[2]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "XTRA",
      unitPrice: 229,
      label: "Innbæring",
    });
  });

  it("keeps full delivery pricing on the first selected product only", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "INDOOR",
      unitPrice: 669,
      label: "Innbæring",
    });
  });

  it("ignores earlier empty cards when deciding XTRA pricing", () => {
    const product = buildProduct();
    const cards = [
      buildCard({
        cardId: 1,
        productId: null,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.FIRST_STEP,
      }),
    ];

    const result = buildProductBreakdowns(cards, [product], []);

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "FIRST_STEP",
      unitPrice: 590,
      label: "Første trinn",
    });
  });

  it("keeps the most expensive indoor delivery as main even if it was added later", () => {
    const cheaperProduct = buildProduct({
      id: "product-1",
      deliveryTypes: [
        {
          key: DELIVERY_TYPES.INDOOR,
          code: "INDOOR",
          label: "Innbæring",
          price: "600",
          xtraPrice: "250",
        },
        ...createDefaultProductDeliveryTypes().filter(
          (item) => item.key !== DELIVERY_TYPES.INDOOR,
        ),
      ],
    });
    const moreExpensiveProduct = buildProduct({
      id: "product-2",
      code: "PROD-2",
      label: "Sofa",
      deliveryTypes: [
        {
          key: DELIVERY_TYPES.INDOOR,
          code: "INDOOR",
          label: "Innbæring",
          price: "1300",
          xtraPrice: "250",
        },
        ...createDefaultProductDeliveryTypes().filter(
          (item) => item.key !== DELIVERY_TYPES.INDOOR,
        ),
      ],
    });

    const cards = [
      buildCard({
        cardId: 1,
        productId: "product-1",
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 2,
        productId: "product-2",
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
    ];

    const result = buildProductBreakdowns(
      cards,
      [cheaperProduct, moreExpensiveProduct],
      [],
    );

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "XTRA",
      unitPrice: 250,
      label: "Innbæring",
    });
    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      unitPrice: 1300,
      label: "Innbæring",
    });
  });

  it("keeps the most expensive shared delivery type as main across first-step and indoor", () => {
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.FIRST_STEP,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
    ];

    const result = buildProductBreakdowns(cards, [buildProduct()], []);

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "XTRA",
      unitPrice: 150,
      label: "Første trinn",
    });
    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "INDOOR",
      unitPrice: 669,
      label: "Innbæring",
    });
  });

  it("zeros the non-XTRA base delivery price over 100 km", () => {
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.FIRST_STEP,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
    ];

    const result = buildProductBreakdowns(cards, [buildProduct()], [], {
      zeroBaseDeliveryPricesOver100Km: true,
    });

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "XTRA",
      unitPrice: 150,
    });
    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "INDOOR",
      unitPrice: 0,
    });
  });

  it("zeros install-only and return-only delivery prices over 100 km", () => {
    const cards = [
      buildCard({
        cardId: 1,
        deliveryType: DELIVERY_TYPES.INSTALL_ONLY,
      }),
      buildCard({
        cardId: 2,
        deliveryType: DELIVERY_TYPES.RETURN_ONLY,
      }),
    ];

    const result = buildProductBreakdowns(cards, [buildProduct()], [], {
      zeroBaseDeliveryPricesOver100Km: true,
    });

    expect(result[0]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "XTRA",
      unitPrice: 0,
      label: "Kun Installasjon/Montering",
    });
    expect(result[1]?.items[0]).toMatchObject({
      kind: "deliveryType",
      code: "RETURN_ONLY",
      unitPrice: 0,
      label: "Kun retur",
    });
  });

  it("keeps an optional model number on the product breakdown", () => {
    const result = buildProductBreakdowns(
      [
        buildCard({
          modelNumber: "WM-42",
        }),
      ],
      [buildProduct()],
      [],
    );

    expect(result[0]).toMatchObject({
      productName: "Seng",
      productModelNumber: "WM-42",
    });
  });

  it("keeps imported install and return selections visible without inventing an install-only delivery line", () => {
    const product = buildProduct({
      allowReturnOptions: true,
    });

    const result = buildProductBreakdowns(
      [
        buildCard({
          selectedInstallOptionIds: ["install-1"],
          selectedReturnOptionId: "return-store",
        }),
      ],
      [product],
      returnOptions,
    );

    expect(result[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "install-1",
          qty: 1,
        }),
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "return-store",
          qty: 1,
        }),
      ]),
    );
    expect(result[0]?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "deliveryType",
          code: "INSTALL_ONLY",
        }),
      ]),
    );
  });

  it("uses the matching automatic XTRA option for first-step and indoor quantity extras", () => {
    const product = buildProduct({
      allowInstallOptions: false,
      options: [
        {
          id: "base-option",
          code: "BASE",
          label: "Base",
          description: "Base",
          category: null,
          customerPrice: "300",
          subcontractorPrice: "100",
          effectiveCustomerPrice: "300",
          active: true,
        },
      ],
    });

    const firstStepResult = buildProductBreakdowns(
      [
        buildCard({
          amount: 2,
          deliveryType: DELIVERY_TYPES.FIRST_STEP,
        }),
      ],
      [product],
      automaticXtraOptions,
    );

    const indoorResult = buildProductBreakdowns(
      [
        buildCard({
          amount: 2,
          deliveryType: DELIVERY_TYPES.INDOOR,
        }),
      ],
      [product],
      automaticXtraOptions,
    );

    expect(firstStepResult[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "xtra-first-step",
          qty: 1,
        }),
      ]),
    );
    expect(indoorResult[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "xtra-indoor",
          qty: 1,
        }),
      ]),
    );
  });
});
