import { describe, expect, it } from "vitest";
import { customerOrderProducts } from "./customerOrderProducts";

const card = (over: Record<string, unknown>) => ({
  cardId: 1,
  itemType: "PRODUCT_CARD",
  productId: "p1",
  productCode: "WG_WASHING_MACHINE",
  productName: "Washing machine",
  deliveryType: "Delivery with carry-in",
  optionLabel: null,
  quantity: 1,
  rawData: {},
  ...over,
});
const option = (over: Record<string, unknown>) => card({ itemType: "EXTRA_OPTION", deliveryType: null, ...over });

describe("customerOrderProducts", () => {
  it("lists each product card with its code, the product's icon key, name and count, in card order", () => {
    const products = customerOrderProducts(
      [
        card({ cardId: 2, productId: "p2", productCode: "FN_CHEST_OF_DRAWERS", productName: "Chest of drawers", deliveryType: null, quantity: 2 }),
        card({ cardId: 1 }),
      ],
      [
        { id: "p1", iconKey: null },
        { id: "p2", iconKey: "fn_chest_of_drawers" },
      ],
    );

    expect(products).toEqual([
      {
        cardId: 1,
        code: "WG_WASHING_MACHINE",
        iconKey: null,
        name: "Washing machine",
        itemName: null,
        count: 1,
        deliveryType: "Delivery with carry-in",
        services: [],
      },
      {
        cardId: 2,
        code: "FN_CHEST_OF_DRAWERS",
        iconKey: "fn_chest_of_drawers",
        name: "Chest of drawers",
        itemName: null,
        count: 2,
        deliveryType: null,
        services: [],
      },
    ]);
  });

  it("gives each product its own services: install, extras and return, once each", () => {
    const [washer, dryer] = customerOrderProducts(
      [
        card({ cardId: 1 }),
        option({ cardId: 1, itemType: "INSTALL_OPTION", optionLabel: "Installation – integrated" }),
        option({ cardId: 1, optionLabel: "Unpacking and disposal of packaging" }),
        option({ cardId: 1, optionLabel: "Unpacking and disposal of packaging" }),
        option({ cardId: 1, itemType: "RETURN_OPTION", optionLabel: "Return of old appliance" }),
        card({ cardId: 2, productCode: "WG_TUMBLE_DRYER", productName: "Tumble dryer" }),
        option({ cardId: 2, optionLabel: "Stacking kit" }),
      ],
      [],
    );

    expect(washer.services).toEqual(["Installation – integrated", "Unpacking and disposal of packaging", "Return of old appliance"]);
    expect(dryer.services).toEqual(["Stacking kit"]);
  });

  it("leaves out the delivery price lines and labour-hour lines — those aren't services", () => {
    const [product] = customerOrderProducts(
      [
        card({}),
        option({ optionLabel: "Delivery with carry-in", rawData: { source: "delivery_type_price" } }),
        option({ optionLabel: "Extra unit", rawData: { source: "white_goods_extra_unit" } }),
        option({ optionLabel: "Base delivery", rawData: { source: "auto_delivery_price" } }),
        option({ optionLabel: "Base delivery xtra", rawData: { source: "auto_delivery_price_xtra" } }),
        option({ itemType: "BASE_OPTION", optionLabel: "Hourly rate" }),
        option({ optionLabel: "  " }),
      ],
      [],
    );

    expect(product.services).toEqual([]);
  });

  it("gives the catch-all furniture product what the customer called it", () => {
    const [product] = customerOrderProducts(
      [card({ productCode: "FN_OTHER_FURNITURE", productName: "Other furniture", rawData: { modelNumber: " Piano stool " } })],
      [],
    );

    expect(product.itemName).toBe("Piano stool");
  });

  it("ignores a model number on an ordinary product, and a count below one", () => {
    const [product] = customerOrderProducts([card({ rawData: { modelNumber: "WM-1234" }, quantity: 0 })], []);

    expect(product.itemName).toBeNull();
    expect(product.count).toBe(1);
  });
});
