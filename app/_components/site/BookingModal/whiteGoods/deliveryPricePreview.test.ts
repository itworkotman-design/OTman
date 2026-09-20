import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import { previewCardDeliveryOptions } from "./deliveryPricePreview";

function makeProduct(
  id: string,
  firstStepPrice: number,
  indoorPrice: number,
  xtraPrice = 229,
  xtraSubcontractorPrice = 100,
): CatalogProduct {
  const deliveryTypes = createDefaultProductDeliveryTypes().map((dt) => {
    if (dt.key === "FIRST_STEP") {
      return { ...dt, price: String(firstStepPrice), xtraPrice: String(xtraPrice), xtraSubcontractorPrice: String(xtraSubcontractorPrice) };
    }
    if (dt.key === "INDOOR") {
      return { ...dt, price: String(indoorPrice), xtraPrice: String(xtraPrice), xtraSubcontractorPrice: String(xtraSubcontractorPrice) };
    }
    return dt;
  });

  return {
    id,
    code: `CODE_${id}`,
    label: `Product ${id}`,
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
    deliveryTypes,
    customSections: [],
    options: [],
  };
}

describe("previewCardDeliveryOptions", () => {
  it("shows the full standard price for both options when it's the only card", () => {
    const product = makeProduct("p1", 600, 690);
    const card = { ...createEmptyProductCard(0), productId: "p1", deliveryType: "" as const };

    const preview = previewCardDeliveryOptions([card], [product], card.cardId);

    expect(preview.firstStep).toEqual({ price: 600, subcontractorPrice: 0, isExtra: false });
    expect(preview.indoor).toEqual({ price: 690, subcontractorPrice: 0, isExtra: false });
  });

  it("marks BOTH of the losing card's options as extra, not just the one it picked", () => {
    // Reproduces the reported bug: card A picks the cheaper doorstep
    // option, card B picks a pricier carry-in option and becomes the
    // order's "main" (full-price) delivery. A's *unselected* carry-in
    // option happens to list the same standard price as B's (690) — it
    // must still show the extra rate, not full price via a same-price
    // tie-break against B.
    const cardAProduct = makeProduct("a", 600, 690);
    const cardBProduct = makeProduct("b", 610, 690);
    const cardA = { ...createEmptyProductCard(0), productId: "a", deliveryType: "FIRST_STEP" as const };
    const cardB = { ...createEmptyProductCard(1), productId: "b", deliveryType: "INDOOR" as const };

    const preview = previewCardDeliveryOptions([cardA, cardB], [cardAProduct, cardBProduct], cardA.cardId);

    expect(preview.firstStep).toEqual({ price: 229, subcontractorPrice: 100, isExtra: true });
    expect(preview.indoor).toEqual({ price: 229, subcontractorPrice: 100, isExtra: true });
  });

  it("keeps BOTH of the winning card's options at full price, including the one it didn't pick", () => {
    const cardAProduct = makeProduct("a", 600, 690);
    const cardBProduct = makeProduct("b", 610, 690);
    const cardA = { ...createEmptyProductCard(0), productId: "a", deliveryType: "FIRST_STEP" as const };
    const cardB = { ...createEmptyProductCard(1), productId: "b", deliveryType: "INDOOR" as const };

    const preview = previewCardDeliveryOptions([cardA, cardB], [cardAProduct, cardBProduct], cardB.cardId);

    expect(preview.firstStep).toEqual({ price: 610, subcontractorPrice: 0, isExtra: false });
    expect(preview.indoor).toEqual({ price: 690, subcontractorPrice: 0, isExtra: false });
  });

  it("treats the sole card with no delivery type chosen yet as not extra by default", () => {
    const cardAProduct = makeProduct("a", 600, 690);
    const card = { ...createEmptyProductCard(0), productId: "a", deliveryType: "" as const };

    const preview = previewCardDeliveryOptions([card], [cardAProduct], card.cardId);

    expect(preview.firstStep.isExtra).toBe(false);
    expect(preview.indoor.isExtra).toBe(false);
  });

  it("previews a second, not-yet-decided card as extra as soon as an earlier card has a real delivery selection", () => {
    // Reproduces the reported friction: card A (first product) already picked
    // a delivery type, card B (second product) was just added and hasn't
    // touched its own delivery buttons yet. B's preview must already show
    // the extra rate — it shouldn't take a click on B's own buttons to
    // reveal what price it will actually be charged.
    const cardAProduct = makeProduct("a", 600, 690);
    const cardBProduct = makeProduct("b", 1000, 1300);
    const cardA = { ...createEmptyProductCard(0), productId: "a", deliveryType: "FIRST_STEP" as const };
    const cardB = { ...createEmptyProductCard(1), productId: "b", deliveryType: "" as const };

    const preview = previewCardDeliveryOptions([cardA, cardB], [cardAProduct, cardBProduct], cardB.cardId);

    expect(preview.firstStep).toEqual({ price: 229, subcontractorPrice: 100, isExtra: true });
    expect(preview.indoor).toEqual({ price: 229, subcontractorPrice: 100, isExtra: true });
  });

  it("keeps the first, already-decided card at full price when a later card is still undecided", () => {
    const cardAProduct = makeProduct("a", 600, 690);
    const cardBProduct = makeProduct("b", 1000, 1300);
    const cardA = { ...createEmptyProductCard(0), productId: "a", deliveryType: "FIRST_STEP" as const };
    const cardB = { ...createEmptyProductCard(1), productId: "b", deliveryType: "" as const };

    const preview = previewCardDeliveryOptions([cardA, cardB], [cardAProduct, cardBProduct], cardA.cardId);

    expect(preview.firstStep).toEqual({ price: 600, subcontractorPrice: 0, isExtra: false });
    expect(preview.indoor).toEqual({ price: 690, subcontractorPrice: 0, isExtra: false });
  });

  it("breaks an exact price tie in favor of the earlier-added card, even after the later card is the one just clicked", () => {
    // Card A (added first) picks doorstep. Card B (added second) picks
    // carry-in whose price happens to exactly equal card A's doorstep
    // price — a genuine tie, not a "B is pricier" case. Card A must stay
    // the main/full-price card; B is the one that goes extra.
    const cardAProduct = makeProduct("a", 600, 800);
    const cardBProduct = makeProduct("b", 500, 600);
    const cardA = { ...createEmptyProductCard(0), productId: "a", deliveryType: "FIRST_STEP" as const };
    const cardB = { ...createEmptyProductCard(1), productId: "b", deliveryType: "INDOOR" as const };

    const previewA = previewCardDeliveryOptions([cardA, cardB], [cardAProduct, cardBProduct], cardA.cardId);
    const previewB = previewCardDeliveryOptions([cardA, cardB], [cardAProduct, cardBProduct], cardB.cardId);

    expect(previewA.firstStep.isExtra).toBe(false);
    expect(previewB.firstStep.isExtra).toBe(true);
  });

  it("does not let a zero-priced install-only card make a real delivery card preview as extra", () => {
    // Reproduces a live bug: card A has real doorstep delivery (608.88), card
    // B is marked "installation only" (0 kr, no delivery). Because the
    // white-goods catalog always prices INSTALL_ONLY at 0, card B must not
    // steal "main" status from card A just by existing.
    const cardAProduct = makeProduct("a", 600, 800);
    const cardBProduct = {
      ...makeProduct("b", 500, 700),
      deliveryTypes: makeProduct("b", 500, 700).deliveryTypes.map((dt) =>
        dt.key === "INSTALL_ONLY" ? { ...dt, price: "0", xtraPrice: "0" } : dt,
      ),
    };
    const cardA = { ...createEmptyProductCard(0), productId: "a", deliveryType: "FIRST_STEP" as const };
    const cardB = { ...createEmptyProductCard(1), productId: "b", deliveryType: "INSTALL_ONLY" as const };

    const previewA = previewCardDeliveryOptions([cardA, cardB], [cardAProduct, cardBProduct], cardA.cardId);

    expect(previewA.firstStep).toEqual({ price: 600, subcontractorPrice: 0, isExtra: false });
  });

  it("when both cards are still undecided, only the earlier one previews at full price", () => {
    const cardAProduct = makeProduct("a", 600, 690);
    const cardBProduct = makeProduct("b", 1000, 1300);
    const cardA = { ...createEmptyProductCard(0), productId: "a", deliveryType: "" as const };
    const cardB = { ...createEmptyProductCard(1), productId: "b", deliveryType: "" as const };

    const previewA = previewCardDeliveryOptions([cardA, cardB], [cardAProduct, cardBProduct], cardA.cardId);
    const previewB = previewCardDeliveryOptions([cardA, cardB], [cardAProduct, cardBProduct], cardB.cardId);

    expect(previewA.firstStep.isExtra).toBe(false);
    expect(previewB.firstStep.isExtra).toBe(true);
  });
});
