import { describe, expect, it } from "vitest";
import { createEmptyProductCard, type CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { AdminPickupStop } from "@/lib/orders/websiteOrderDetailsEdit";
import {
  addProductToOrder,
  addStop,
  editorBlockers,
  pickupFieldsFor,
  removeCardFromOrder,
  removeStop,
  stopsForSave,
  stopsFromDetails,
  stopsWithoutProducts,
  toggleCardOnStop,
  type EditorStop,
} from "./websiteOrderEditorState";

const card = (cardId: number, productId = "p-wm") => ({ ...createEmptyProductCard(cardId), productId, amount: 1, deliveryType: "FIRST_STEP" as const });
const names: Record<number, string> = { 0: "Vaskemaskin #1", 1: "Vaskemaskin #2", 2: "Sofa" };
const nameOf = (cardId: number) => names[cardId] ?? `#${cardId}`;

const stop = (overrides: Partial<AdminPickupStop> = {}): AdminPickupStop => ({
  source: "store",
  placeName: "Power",
  address: "Strømmen 1",
  floor: null,
  liftAvailable: false,
  contactName: "",
  contactPhone: "",
  productNames: [],
  ...overrides,
});

const editorStop = (cardIds: number[], overrides: Partial<EditorStop> = {}): EditorStop => ({
  source: "store",
  placeName: "Power",
  address: "Strømmen 1",
  floor: null,
  liftAvailable: false,
  contactName: "",
  contactPhone: "",
  ...overrides,
  cardIds,
});

describe("stopsFromDetails", () => {
  it("a single stop collects every product", () => {
    const stops = stopsFromDetails([stop()], [card(0), card(1, "p-sofa")], nameOf);
    expect(stops.map((s) => s.cardIds)).toEqual([[0, 1]]);
  });

  it("puts each product on its stop by card id", () => {
    const stops = stopsFromDetails(
      [stop({ cardIds: [1] }), stop({ address: "Bjerkeveien 2", cardIds: [0] })],
      [card(0), card(1)],
      nameOf,
    );
    expect(stops.map((s) => s.cardIds)).toEqual([[1], [0]]);
  });

  it("falls back to the stored product names on older orders", () => {
    const stops = stopsFromDetails(
      [stop({ productNames: ["Sofa"] }), stop({ address: "Bjerkeveien 2", productNames: ["Vaskemaskin #1"] })],
      [card(0), card(2, "p-sofa")],
      nameOf,
    );
    expect(stops.map((s) => s.cardIds)).toEqual([[2], [0]]);
  });

  it("starts with one empty stop when the order has none", () => {
    expect(stopsFromDetails([], [card(0)], nameOf).map((s) => s.cardIds)).toEqual([[0]]);
  });
});

describe("toggleCardOnStop", () => {
  it("ticking a product on one stop takes it off every other stop", () => {
    const next = toggleCardOnStop([editorStop([0, 1]), editorStop([])], 1, 1, true);
    expect(next.map((s) => s.cardIds)).toEqual([[0], [1]]);
  });

  it("unticking leaves the product without a stop", () => {
    const next = toggleCardOnStop([editorStop([0, 1]), editorStop([])], 0, 1, false);
    expect(next.map((s) => s.cardIds)).toEqual([[0], []]);
  });
});

describe("addProductToOrder / removeCardFromOrder", () => {
  it("a new product goes on the only stop", () => {
    const { cards, stops } = addProductToOrder([card(0)], [editorStop([0])], "p-sofa");
    expect(cards.map((c) => [c.cardId, c.productId])).toEqual([
      [0, "p-wm"],
      [1, "p-sofa"],
    ]);
    expect(stops.map((s) => s.cardIds)).toEqual([[0, 1]]);
  });

  it("with several stops a new product is left unassigned until ticked", () => {
    const { stops } = addProductToOrder([card(0), card(1)], [editorStop([0]), editorStop([1])], "p-sofa");
    expect(stops.map((s) => s.cardIds)).toEqual([[0], [1]]);
  });

  it("adding a product already on the order adds another card for it, next to the others", () => {
    const { cards } = addProductToOrder([card(0), card(1, "p-sofa")], [editorStop([0, 1])], "p-wm");
    expect(cards.map((c) => [c.cardId, c.productId])).toEqual([
      [0, "p-wm"],
      [2, "p-wm"],
      [1, "p-sofa"],
    ]);
  });

  it("removing a product takes it off its stop", () => {
    const { cards, stops } = removeCardFromOrder([card(0), card(1)], [editorStop([0]), editorStop([1])], 1);
    expect(cards.map((c) => c.cardId)).toEqual([0]);
    expect(stops.map((s) => s.cardIds)).toEqual([[0], []]);
  });
});

describe("addStop / removeStop", () => {
  it("a new stop starts empty; the first keeps its products", () => {
    const next = addStop([editorStop([0, 1])]);
    expect(next.map((s) => s.cardIds)).toEqual([[0, 1], []]);
    expect(next[1].address).toBe("");
  });

  it("removing a stop leaves its products unassigned", () => {
    const next = removeStop([editorStop([0]), editorStop([1]), editorStop([2])], [card(0), card(1), card(2)], 1);
    expect(next.map((s) => s.cardIds)).toEqual([[0], [2]]);
  });

  it("back down to one stop, it collects everything again", () => {
    const next = removeStop([editorStop([0]), editorStop([1])], [card(0), card(1)], 1);
    expect(next.map((s) => s.cardIds)).toEqual([[0, 1]]);
  });

  it("never removes the last stop", () => {
    const only = [editorStop([0])];
    expect(removeStop(only, [card(0)], 0)).toBe(only);
  });
});

describe("stopsForSave", () => {
  it("sends each stop's card ids with their display names", () => {
    expect(stopsForSave([editorStop([0]), editorStop([2], { address: "Bjerkeveien 2" })], nameOf)).toEqual([
      expect.objectContaining({ address: "Strømmen 1", cardIds: [0], productNames: ["Vaskemaskin #1"] }),
      expect.objectContaining({ address: "Bjerkeveien 2", cardIds: [2], productNames: ["Sofa"] }),
    ]);
  });

  it("drops the contact person on a store stop — the booking flow never asks for one there", () => {
    const [saved] = stopsForSave([editorStop([0], { contactName: "Kari", contactPhone: "12345678" })], nameOf);
    expect(saved).toEqual(expect.objectContaining({ contactName: "", contactPhone: "" }));
  });

  it("keeps the contact person on private and business stops", () => {
    const saved = stopsForSave(
      [
        editorStop([0], { source: "private", contactName: "Kari", contactPhone: "123" }),
        editorStop([2], { source: "business", contactName: "Ola", contactPhone: "456" }),
      ],
      nameOf,
    );
    expect(saved.map((s) => [s.contactName, s.contactPhone])).toEqual([
      ["Kari", "123"],
      ["Ola", "456"],
    ]);
  });
});

describe("pickupFieldsFor", () => {
  it("a store asks for its name only", () => {
    expect(pickupFieldsFor("store")).toEqual({ placeName: true, contactPerson: false, floor: false });
  });

  it("a private pickup asks for a contact person and floor, no place name", () => {
    expect(pickupFieldsFor("private")).toEqual({ placeName: false, contactPerson: true, floor: true });
  });

  it("a business asks for everything", () => {
    expect(pickupFieldsFor("business")).toEqual({ placeName: true, contactPerson: true, floor: true });
  });

  it("an older stop with no type shows every field", () => {
    expect(pickupFieldsFor(null)).toEqual({ placeName: true, contactPerson: true, floor: true });
  });
});

describe("editorBlockers", () => {
  const washer = { id: "p-wm", code: "WG_WASHING_MACHINE", options: [], deliveryTypes: [] } as unknown as CatalogProduct;

  it("is empty for a complete order", () => {
    expect(editorBlockers([card(0)], [editorStop([0])], [washer])).toEqual([]);
  });

  it("flags a product without a pickup stop", () => {
    // The second stop is then empty too.
    expect(editorBlockers([card(0), card(1)], [editorStop([0]), editorStop([], { address: "Bjerkeveien 2" })], [washer])).toEqual([
      "PRODUCT_WITHOUT_PICKUP",
      "PICKUP_WITHOUT_PRODUCT",
    ]);
  });

  it("flags a pickup address that collects no products", () => {
    expect(editorBlockers([card(0), card(1)], [editorStop([0, 1]), editorStop([], { address: "Bjerkeveien 2" })], [washer])).toEqual([
      "PICKUP_WITHOUT_PRODUCT",
    ]);
  });

  it("flags a stop with products but no address", () => {
    expect(editorBlockers([card(0), card(1)], [editorStop([0]), editorStop([1], { address: "" })], [washer])).toEqual([
      "PRODUCT_WITHOUT_PICKUP",
    ]);
  });
});

describe("stopsWithoutProducts", () => {
  it("lists the (0-based) stops that collect nothing", () => {
    expect(stopsWithoutProducts([editorStop([0]), editorStop([]), editorStop([1]), editorStop([])])).toEqual([1, 3]);
  });

  it("a lone stop always collects everything, so it's never listed", () => {
    expect(stopsWithoutProducts([editorStop([])])).toEqual([]);
  });
});
