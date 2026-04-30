import { describe, expect, it } from "vitest";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import type { CalculatorResult } from "@/lib/booking/pricing/types";
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
  {
    id: "return-recycle",
    type: "return",
    code: "RETURNREC",
    label: "Return",
    description: "Retur til gjenvinning",
    customerPrice: "250",
    subcontractorPrice: "0",
    effectiveCustomerPrice: "250",
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

function calculateProductCards(
  cards: SavedProductCard[],
  products: CatalogProduct[],
  specialOptions: CatalogSpecialOption[] = returnOptions,
): CalculatorResult {
  return calculateBookingPricing({
    productBreakdowns: buildProductBreakdowns(cards, products, specialOptions),
    priceLookup: buildPriceLookup(products, specialOptions),
  });
}

function getProductLines(result: CalculatorResult, productName: string) {
  return (
    result.breakdowns.find((breakdown) => breakdown.productName === productName)
      ?.lines ?? []
  );
}

function getChargedCodes(result: CalculatorResult) {
  return result.breakdowns
    .flatMap((breakdown) =>
      breakdown.lines
        .filter((line) => line.lineTotal > 0)
        .map((line) => `${breakdown.productName}:${line.code ?? line.label}`),
    )
    .sort();
}

function expectNoTransportCodes(result: CalculatorResult, productName: string) {
  const lines = getProductLines(result, productName);

  expect(lines).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "INDOOR" }),
      expect.objectContaining({ code: "XTRA" }),
    ]),
  );
}

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

  it("preserves multiplied WordPress read-only quantities as unit prices", () => {
    const result = calculateProductCards(
      [
        buildCard({
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
              {
                label: "XTRA",
                code: "XTRA",
                quantity: 3,
                priceCents: 22900,
              },
            ],
          },
        }),
      ],
      [buildProduct()],
      [],
    );

    expect(result.breakdowns[0]?.readOnly).toBe(true);
    expect(result.breakdowns[0]?.lines).toEqual([
      expect.objectContaining({
        code: "INSDISHW2",
        qty: 4,
        unitPrice: 2249,
        lineTotal: 8996,
      }),
      expect.objectContaining({
        code: "XTRA",
        qty: 3,
        unitPrice: 229,
        lineTotal: 687,
      }),
    ]);
    expect(result.totals.totalExVat).toBe(9683);
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

  it("zeros return-only RETURNIN delivery prices over 100 km", () => {
    const cards = [
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
      code: "RETURNIN",
      unitPrice: 0,
      label: "Kun retur",
    });
  });

  it("does not apply automatic XTRA quantity pricing to install-only or return-only deliveries", () => {
    const cards = [
      buildCard({
        cardId: 1,
        amount: 3,
        deliveryType: DELIVERY_TYPES.INSTALL_ONLY,
      }),
      buildCard({
        cardId: 2,
        amount: 3,
        deliveryType: DELIVERY_TYPES.RETURN_ONLY,
      }),
    ];

    const result = buildProductBreakdowns(
      cards,
      [buildProduct({ allowReturnOptions: true })],
      automaticXtraOptions,
    );

    expect(result[0]?.items).toEqual([]);
    expect(result[0]?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "xtra-indoor",
        }),
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "xtra-first-step",
        }),
      ]),
    );
    expect(result[1]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "deliveryType",
          code: "RETURNIN",
          qty: 1,
        }),
      ]),
    );
    expect(result[1]?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "xtra-indoor",
        }),
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "xtra-first-step",
        }),
      ]),
    );
    expect(result[0]?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          qty: 2,
        }),
      ]),
    );
    expect(result[1]?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          qty: 2,
        }),
      ]),
    );
  });

  it("still applies automatic XTRA quantity pricing to indoor and first-step deliveries", () => {
    const cards = [
      buildCard({
        cardId: 1,
        amount: 3,
        deliveryType: DELIVERY_TYPES.INDOOR,
      }),
      buildCard({
        cardId: 2,
        amount: 2,
        deliveryType: DELIVERY_TYPES.FIRST_STEP,
      }),
    ];

    const result = buildProductBreakdowns(cards, [buildProduct()], automaticXtraOptions);

    expect(result[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "xtra-indoor",
          qty: 2,
        }),
      ]),
    );
    expect(result[1]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "xtra-first-step",
          qty: 1,
        }),
      ]),
    );
  });

  it("keeps install-only cards limited to selected install options", () => {
    const result = buildProductBreakdowns(
      [
        buildCard({
          amount: 2,
          deliveryType: DELIVERY_TYPES.INSTALL_ONLY,
          selectedInstallOptionIds: ["install-1"],
        }),
      ],
      [buildProduct()],
      automaticXtraOptions,
    );

    expect(result[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "install-1",
          qty: 2,
        }),
      ]),
    );
    expect(result[0]?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "deliveryType",
        }),
      ]),
    );
  });

  it("charges RETURNIN once and only charges return services on later return-only products", () => {
    const product = buildProduct({
      allowReturnOptions: true,
    });

    const result = buildProductBreakdowns(
      [
        buildCard({
          cardId: 1,
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-store",
        }),
        buildCard({
          cardId: 2,
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-recycle",
        }),
      ],
      [product],
      returnOptions,
    );

    expect(result[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "deliveryType",
          code: "RETURNIN",
          unitPrice: 669,
        }),
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "return-store",
          priceOverride: 0,
        }),
      ]),
    );
    expect(result[1]?.items).toEqual([
      expect.objectContaining({
        kind: "productOption",
        productOptionId: "return-recycle",
      }),
    ]);
  });

  it("does not apply RETURNIN when delivery transport is already covered", () => {
    const product = buildProduct({
      allowReturnOptions: true,
    });

    const result = buildProductBreakdowns(
      [
        buildCard({
          cardId: 1,
          deliveryType: DELIVERY_TYPES.INDOOR,
        }),
        buildCard({
          cardId: 2,
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-recycle",
        }),
      ],
      [product],
      returnOptions,
    );

    expect(result[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "deliveryType",
          code: "INDOOR",
        }),
      ]),
    );
    expect(result[1]?.items).toEqual([
      expect.objectContaining({
        kind: "productOption",
        productOptionId: "return-recycle",
      }),
    ]);
    expect(result[1]?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RETURNIN",
        }),
      ]),
    );
  });

  it("matches the mixed return and installation pricing example", () => {
    const microwave = buildProduct({
      id: "microwave",
      label: "Mikrobølgeovn",
      allowReturnOptions: true,
    });
    const oven = buildProduct({
      id: "oven",
      label: "Ovn",
      allowReturnOptions: true,
    });
    const freezer = buildProduct({
      id: "freezer",
      label: "Fryseskap",
      options: [
        {
          id: "install-freezer",
          code: "INSFRIDGE",
          label: "Installation",
          description: "INSFRIDGE",
          category: "install",
          customerPrice: "399",
          subcontractorPrice: "0",
          effectiveCustomerPrice: "399",
          active: true,
        },
        {
          id: "rehang-door",
          code: "REHANGDOOR2",
          label: "Rehang door",
          description: "REHANGDOOR2",
          category: "install",
          customerPrice: "699",
          subcontractorPrice: "0",
          effectiveCustomerPrice: "699",
          active: true,
        },
      ],
    });

    const result = buildProductBreakdowns(
      [
        buildCard({
          cardId: 1,
          productId: "microwave",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-store",
        }),
        buildCard({
          cardId: 2,
          productId: "oven",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-recycle",
        }),
        buildCard({
          cardId: 3,
          productId: "freezer",
          deliveryType: DELIVERY_TYPES.INSTALL_ONLY,
          selectedInstallOptionIds: ["install-freezer", "rehang-door"],
        }),
      ],
      [microwave, oven, freezer],
      returnOptions,
    );

    expect(result[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "return-store",
          priceOverride: 0,
        }),
        expect.objectContaining({
          kind: "deliveryType",
          code: "RETURNIN",
          unitPrice: 669,
        }),
      ]),
    );
    expect(result[1]?.items).toEqual([
      expect.objectContaining({
        kind: "productOption",
        productOptionId: "return-recycle",
      }),
    ]);
    expect(result[2]?.items).toEqual([
      expect.objectContaining({
        kind: "productOption",
        productOptionId: "install-freezer",
      }),
      expect.objectContaining({
        kind: "productOption",
        productOptionId: "rehang-door",
      }),
    ]);
  });

  it("matches WP behavior for a single return-only product", () => {
    const microwave = buildProduct({
      id: "microwave",
      label: "Mikrobølgeovn",
      allowReturnOptions: true,
    });

    const result = calculateProductCards(
      [
        buildCard({
          cardId: 1,
          productId: "microwave",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-store",
        }),
      ],
      [microwave],
    );
    const lines = getProductLines(result, "Mikrobølgeovn");

    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RETURNIN",
          unitPrice: 669,
          lineTotal: 669,
        }),
        expect.objectContaining({
          code: "RETURNSTORE",
          unitPrice: 0,
          lineTotal: 0,
        }),
      ]),
    );
    expectNoTransportCodes(result, "Mikrobølgeovn");
    expect(result.totals.totalExVat).toBe(669);
  });

  it("matches WP behavior for multiple return-only products without delivery", () => {
    const microwave = buildProduct({
      id: "microwave",
      label: "Mikrobølgeovn",
      allowReturnOptions: true,
    });
    const oven = buildProduct({
      id: "oven",
      label: "Ovn",
      allowReturnOptions: true,
    });

    const result = calculateProductCards(
      [
        buildCard({
          cardId: 1,
          productId: "microwave",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-store",
        }),
        buildCard({
          cardId: 2,
          productId: "oven",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-recycle",
        }),
      ],
      [microwave, oven],
    );

    expect(getProductLines(result, "Mikrobølgeovn")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RETURNIN",
          unitPrice: 669,
          lineTotal: 669,
        }),
        expect.objectContaining({
          code: "RETURNSTORE",
          unitPrice: 0,
          lineTotal: 0,
        }),
      ]),
    );
    expect(getProductLines(result, "Ovn")).toEqual([
      expect.objectContaining({
        code: "RETURNREC",
        unitPrice: 250,
        lineTotal: 250,
      }),
    ]);
    expect(result.totals.totalExVat).toBe(919);
  });

  it("matches WP behavior for return-only products plus installation without delivery", () => {
    const microwave = buildProduct({
      id: "microwave",
      label: "Mikrobølgeovn",
      allowReturnOptions: true,
    });
    const oven = buildProduct({
      id: "oven",
      label: "Ovn",
      allowReturnOptions: true,
    });
    const freezer = buildProduct({
      id: "freezer",
      label: "Fryseskap",
      options: [
        {
          id: "install-freezer",
          code: "INSFRIDGE",
          label: "Installation",
          description: "INSFRIDGE",
          category: "install",
          customerPrice: "399",
          subcontractorPrice: "0",
          effectiveCustomerPrice: "399",
          active: true,
        },
        {
          id: "rehang-door",
          code: "REHANGDOOR2",
          label: "Rehang door",
          description: "REHANGDOOR2",
          category: "install",
          customerPrice: "699",
          subcontractorPrice: "0",
          effectiveCustomerPrice: "699",
          active: true,
        },
      ],
    });

    const result = calculateProductCards(
      [
        buildCard({
          cardId: 1,
          productId: "microwave",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-store",
        }),
        buildCard({
          cardId: 2,
          productId: "oven",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-recycle",
        }),
        buildCard({
          cardId: 3,
          productId: "freezer",
          deliveryType: DELIVERY_TYPES.INSTALL_ONLY,
          selectedInstallOptionIds: ["install-freezer", "rehang-door"],
        }),
      ],
      [microwave, oven, freezer],
    );

    expect(getProductLines(result, "Mikrobølgeovn")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "RETURNIN", lineTotal: 669 }),
        expect.objectContaining({ code: "RETURNSTORE", lineTotal: 0 }),
      ]),
    );
    expect(getProductLines(result, "Ovn")).toEqual([
      expect.objectContaining({ code: "RETURNREC", lineTotal: 250 }),
    ]);
    expect(getProductLines(result, "Fryseskap")).toEqual([
      expect.objectContaining({ code: "INSFRIDGE", lineTotal: 399 }),
      expect.objectContaining({ code: "REHANGDOOR2", lineTotal: 699 }),
    ]);
    expectNoTransportCodes(result, "Fryseskap");
    expect(result.totals.totalExVat).toBe(2017);
  });

  it("does not apply RETURNIN when a delivery product already covers transport", () => {
    const dishwasher = buildProduct({
      id: "dishwasher",
      label: "Oppvaskmaskin",
      allowReturnOptions: true,
      options: [
        {
          id: "install-dishwasher",
          code: "INSDISH",
          label: "Installation",
          description: "INSDISH",
          category: "install",
          customerPrice: "399",
          subcontractorPrice: "0",
          effectiveCustomerPrice: "399",
          active: true,
        },
      ],
    });
    const freezer = buildProduct({
      id: "freezer",
      label: "Fryseskap",
      allowReturnOptions: true,
    });
    const dryer = buildProduct({
      id: "dryer",
      label: "Tørketrommel",
      allowReturnOptions: true,
    });

    const result = calculateProductCards(
      [
        buildCard({
          cardId: 1,
          productId: "dishwasher",
          deliveryType: DELIVERY_TYPES.INDOOR,
          amount: 2,
          selectedInstallOptionIds: ["install-dishwasher"],
          selectedReturnOptionId: "return-recycle",
        }),
        buildCard({
          cardId: 2,
          productId: "freezer",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-recycle",
        }),
        buildCard({
          cardId: 3,
          productId: "dryer",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          selectedReturnOptionId: "return-recycle",
        }),
      ],
      [dishwasher, freezer, dryer],
      [...returnOptions, ...automaticXtraOptions],
    );

    expect(getProductLines(result, "Oppvaskmaskin")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INDOOR" }),
        expect.objectContaining({ code: "XTRA" }),
        expect.objectContaining({ code: "INSDISH" }),
        expect.objectContaining({ code: "RETURNREC" }),
      ]),
    );
    expect(getProductLines(result, "Fryseskap")).toEqual([
      expect.objectContaining({ code: "RETURNREC" }),
    ]);
    expect(getProductLines(result, "Tørketrommel")).toEqual([
      expect.objectContaining({ code: "RETURNREC" }),
    ]);
    expect(result.breakdowns.flatMap((breakdown) => breakdown.lines)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RETURNIN",
        }),
      ]),
    );
  });

  it("matches WP total when indoor delivery covers transport and return-only products should not get XTRA", () => {
    const dishwasher = buildProduct({
      id: "dishwasher",
      label: "Oppvaskmaskin",
      allowReturnOptions: true,
      options: [],
    });
    const freezer = buildProduct({
      id: "freezer",
      label: "Fryseskap",
      allowReturnOptions: true,
    });
    const hob = buildProduct({
      id: "hob",
      label: "Platetopp",
      allowReturnOptions: true,
      options: [
        {
          id: "install-hob",
          code: "INSHOB",
          label: "Hob install",
          description: "INSHOB",
          category: "install",
          customerPrice: "6000",
          subcontractorPrice: "0",
          effectiveCustomerPrice: "6000",
          active: true,
        },
        {
          id: "install-hob-2",
          code: "INSHOB2",
          label: "Hob install 2",
          description: "INSHOB2",
          category: "install",
          customerPrice: "7650",
          subcontractorPrice: "0",
          effectiveCustomerPrice: "7650",
          active: true,
        },
      ],
    });
    const dryer = buildProduct({
      id: "dryer",
      label: "Tørketrommel",
      allowReturnOptions: true,
    });

    const result = calculateProductCards(
      [
        buildCard({
          cardId: 1,
          productId: "dishwasher",
          deliveryType: DELIVERY_TYPES.INDOOR,
          amount: 4,
          selectedReturnOptionId: "return-recycle",
        }),
        buildCard({
          cardId: 2,
          productId: "freezer",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          amount: 3,
          selectedReturnOptionId: "return-recycle",
        }),
        buildCard({
          cardId: 3,
          productId: "hob",
          deliveryType: DELIVERY_TYPES.INDOOR,
          selectedInstallOptionIds: ["install-hob", "install-hob-2"],
          selectedReturnOptionId: "return-recycle",
        }),
        buildCard({
          cardId: 4,
          productId: "dryer",
          deliveryType: DELIVERY_TYPES.RETURN_ONLY,
          amount: 2,
          selectedReturnOptionId: "return-recycle",
        }),
      ],
      [dishwasher, freezer, hob, dryer],
      [...returnOptions, ...automaticXtraOptions],
    );

    expect(getProductLines(result, "Oppvaskmaskin")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INDOOR", lineTotal: 669 }),
        expect.objectContaining({ code: "XTRA", qty: 3, lineTotal: 687 }),
        expect.objectContaining({ code: "RETURNREC", qty: 4, lineTotal: 1000 }),
      ]),
    );
    expect(getProductLines(result, "Fryseskap")).toEqual([
      expect.objectContaining({ code: "RETURNREC", qty: 3, lineTotal: 750 }),
    ]);
    expect(getProductLines(result, "Platetopp")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "XTRA", lineTotal: 229 }),
        expect.objectContaining({ code: "INSHOB", lineTotal: 6000 }),
        expect.objectContaining({ code: "INSHOB2", lineTotal: 7650 }),
        expect.objectContaining({ code: "RETURNREC", lineTotal: 250 }),
      ]),
    );
    expect(getProductLines(result, "Tørketrommel")).toEqual([
      expect.objectContaining({ code: "RETURNREC", qty: 2, lineTotal: 500 }),
    ]);

    for (const productName of ["Fryseskap", "Tørketrommel"]) {
      expect(getProductLines(result, productName)).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "RETURNIN" }),
          expect.objectContaining({ code: "XTRA" }),
        ]),
      );
    }
    expect(result.totals.totalExVat).toBe(17735);
  });

  it("applies RETURNIN to the deterministic primary return-only product across reorderings", () => {
    const products = [
      buildProduct({
        id: "microwave",
        label: "Mikrobølgeovn",
        allowReturnOptions: true,
      }),
      buildProduct({
        id: "oven",
        label: "Ovn",
        allowReturnOptions: true,
      }),
      buildProduct({
        id: "freezer",
        label: "Fryseskap",
        options: [
          {
            id: "install-freezer",
            code: "INSFRIDGE",
            label: "Installation",
            description: "INSFRIDGE",
            category: "install",
            customerPrice: "399",
            subcontractorPrice: "0",
            effectiveCustomerPrice: "399",
            active: true,
          },
          {
            id: "rehang-door",
            code: "REHANGDOOR2",
            label: "Rehang door",
            description: "REHANGDOOR2",
            category: "install",
            customerPrice: "699",
            subcontractorPrice: "0",
            effectiveCustomerPrice: "699",
            active: true,
          },
        ],
      }),
    ];
    const cardTemplates: Record<string, Partial<SavedProductCard>> = {
      microwave: {
        productId: "microwave",
        deliveryType: DELIVERY_TYPES.RETURN_ONLY,
        selectedReturnOptionId: "return-store",
      },
      oven: {
        productId: "oven",
        deliveryType: DELIVERY_TYPES.RETURN_ONLY,
        selectedReturnOptionId: "return-recycle",
      },
      freezer: {
        productId: "freezer",
        deliveryType: DELIVERY_TYPES.INSTALL_ONLY,
        selectedInstallOptionIds: ["install-freezer", "rehang-door"],
      },
    };
    const orderings = [
      ["microwave", "oven", "freezer"],
      ["microwave", "freezer", "oven"],
      ["oven", "microwave", "freezer"],
      ["oven", "freezer", "microwave"],
      ["freezer", "microwave", "oven"],
      ["freezer", "oven", "microwave"],
    ];

    const results = orderings.map((ordering) =>
      calculateProductCards(
        ordering.map((productKey, index) =>
          buildCard({
            cardId: index + 1,
            ...cardTemplates[productKey],
          }),
        ),
        products,
      ),
    );
    const [expected] = results;

    for (const result of results) {
      expect(result.totals.totalExVat).toBe(expected.totals.totalExVat);
      expect(getChargedCodes(result)).toEqual(getChargedCodes(expected));
      expect(getProductLines(result, "Mikrobølgeovn")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "RETURNIN", lineTotal: 669 }),
          expect.objectContaining({ code: "RETURNSTORE", lineTotal: 0 }),
        ]),
      );
      expect(getProductLines(result, "Ovn")).toEqual([
        expect.objectContaining({ code: "RETURNREC", lineTotal: 250 }),
      ]);
    }
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

  it("keeps imported install selections visible without pricing return on install-only cards", () => {
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
      ]),
    );
    expect(result[0]?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "productOption",
          productOptionId: "return-store",
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

  it("adds product auto delivery price as soon as the product is selected", () => {
    const result = buildProductBreakdowns(
      [
        buildCard({
          productId: "product-1",
        }),
      ],
      [
        buildProduct({
          autoDeliveryPrice: {
            enabled: true,
            code: "AUTO_START",
            label: "Startup delivery",
            price: "125",
            subcontractorPrice: "50",
          },
        }),
      ],
      [],
    );

    expect(result[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "customPrice",
          code: "AUTO_START",
          label: "Startup delivery",
          qty: 1,
          unitPrice: 125,
          subcontractorUnitPrice: 50,
        }),
      ]),
    );
  });
});
