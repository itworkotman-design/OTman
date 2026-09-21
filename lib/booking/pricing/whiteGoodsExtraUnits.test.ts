import { describe, expect, it } from "vitest";
import {
  applyWhiteGoodsExtraUnitCharges,
  buildWhiteGoodsExtraUnitOrderItems,
} from "./whiteGoodsExtraUnits";
import { buildProductBreakdowns } from "./fromProductCards";
import { createDefaultProductAutoDeliveryPrice } from "@/lib/products/autoDeliveryPrice";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import {
  createEmptyProductCard,
  type CatalogProduct,
  type CatalogSpecialOption,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// Website white-goods flow only: units beyond the first of a delivery pay the
// delivery type's own xtraPrice. The shared pricing code only charges them
// via a global XTRA special option, which the white-goods catalog doesn't
// have — this module fills that gap without touching the shared code.

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "p1",
    code: "WG_TEST",
    label: "Test",
    active: true,
    productType: "PHYSICAL",
    allowDeliveryTypes: true,
    allowInstallOptions: true,
    allowReturnOptions: true,
    allowExtraServices: true,
    allowDemont: true,
    allowQuantity: true,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: true,
    autoXtraPerPallet: false,
    autoDeliveryPrice: createDefaultProductAutoDeliveryPrice(),
    deliveryTypes: createDefaultProductDeliveryTypes().map((dt) =>
      dt.key === "FIRST_STEP"
        ? { ...dt, price: "610", subcontractorPrice: "300", xtraPrice: "155", xtraSubcontractorPrice: "80" }
        : dt.key === "INDOOR"
          ? { ...dt, price: "690", subcontractorPrice: "350", xtraPrice: "235", xtraSubcontractorPrice: "120" }
          : dt,
    ),
    customSections: [],
    options: [],
    ...overrides,
  };
}

const xtraSpecial: CatalogSpecialOption = {
  id: "xtra-1",
  type: "xtra",
  code: "XTRA",
  label: "Extra",
  description: null,
  customerPrice: "229",
  subcontractorPrice: "100",
  effectiveCustomerPrice: "229",
  active: true,
};

function card(deliveryType: "FIRST_STEP" | "INDOOR" | "INSTALL_ONLY", amount: number) {
  return { ...createEmptyProductCard(0), productId: "p1", deliveryType, amount };
}

function extraUnitLines(cards: ReturnType<typeof card>[], special: CatalogSpecialOption[] = [], product = makeProduct()) {
  const base = buildProductBreakdowns(cards, [product], special);
  return applyWhiteGoodsExtraUnitCharges(base, cards, [product], special)[0].items.filter(
    (i) => i.kind === "customPrice",
  );
}

describe("applyWhiteGoodsExtraUnitCharges", () => {
  it("charges the doorstep xtraPrice for each unit beyond the first", () => {
    expect(extraUnitLines([card("FIRST_STEP", 3)])).toEqual([
      expect.objectContaining({ qty: 2, unitPrice: 155, subcontractorUnitPrice: 80 }),
    ]);
  });

  it("charges the carry-in xtraPrice for carry-in delivery", () => {
    expect(extraUnitLines([card("INDOOR", 2)])).toEqual([
      expect.objectContaining({ qty: 1, unitPrice: 235, subcontractorUnitPrice: 120 }),
    ]);
  });

  it("adds nothing for a single unit or for installation only", () => {
    expect(extraUnitLines([card("FIRST_STEP", 1)])).toEqual([]);
    expect(extraUnitLines([card("INSTALL_ONLY", 3)])).toEqual([]);
  });

  it("adds nothing when the catalog has an XTRA special option (shared code already charges it)", () => {
    expect(extraUnitLines([card("FIRST_STEP", 3)], [xtraSpecial])).toEqual([]);
  });

  it("adds nothing for a product that doesn't allow quantity", () => {
    expect(extraUnitLines([card("FIRST_STEP", 3)], [], makeProduct({ allowQuantity: false }))).toEqual([]);
  });
});

describe("buildWhiteGoodsExtraUnitOrderItems", () => {
  it("produces one order line per card with extra units, priced in cents", () => {
    const items = buildWhiteGoodsExtraUnitOrderItems([card("FIRST_STEP", 3)], [makeProduct()], []);
    expect(items).toEqual([
      expect.objectContaining({
        cardId: 0,
        itemType: "EXTRA_OPTION",
        quantity: 2,
        customerPriceCents: 15500,
        subcontractorPriceCents: 8000,
      }),
    ]);
  });

  it("produces none when the catalog has an XTRA special option", () => {
    expect(buildWhiteGoodsExtraUnitOrderItems([card("FIRST_STEP", 3)], [makeProduct()], [xtraSpecial])).toEqual([]);
  });
});
