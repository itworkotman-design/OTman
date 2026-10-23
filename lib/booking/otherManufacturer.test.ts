import { describe, expect, it } from "vitest";
import {
  cardHasOtherManufacturer,
  findOtherManufacturerCardsMissingName,
  isOtherManufacturerOptionCode,
} from "./otherManufacturer";
import { MAX_ITEM_NAME_LENGTH } from "@/lib/booking/pricing/sizeBrackets";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";
import {
  createEmptyProductCard,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// Assembly "— Other manufacturer" needs the customer to say which company
// made the furniture, typed into the card's free-text field.
const bed = catalogProductFromSeed("FN_BED");
const products = [bed];
const optionId = (code: string) => bed.options.find((o) => o.code === code)!.id;
const otherId = optionId("ASM_SGL_BED_OTHER");
const ikeaId = optionId("ASM_SGL_BED_IKEA");

function card(cardId: number, patch: Partial<SavedProductCard>): SavedProductCard {
  return { ...createEmptyProductCard(cardId), productId: bed.id, deliveryType: "INDOOR", ...patch };
}

describe("isOtherManufacturerOptionCode", () => {
  it("matches assembly options for another manufacturer, in short and old long form", () => {
    expect(isOtherManufacturerOptionCode("ASM_SGL_BED_OTHER")).toBe(true);
    expect(isOtherManufacturerOptionCode("ASM_SGL_BED_OTHER_MANUFACTURER")).toBe(true);
  });

  it("doesn't match a named manufacturer or a non-assembly option", () => {
    expect(isOtherManufacturerOptionCode("ASM_SGL_BED_IKEA")).toBe(false);
    expect(isOtherManufacturerOptionCode("FN_OTHER_FURNITURE")).toBe(false);
    expect(isOtherManufacturerOptionCode("DISMANTLE_DISP_OTHER")).toBe(false);
  });
});

describe("cardHasOtherManufacturer", () => {
  it("is true only while an other-manufacturer assembly is picked", () => {
    expect(cardHasOtherManufacturer(card(1, { selectedInstallOptionIds: [otherId] }), products)).toBe(true);
    expect(cardHasOtherManufacturer(card(1, { selectedInstallOptionIds: [ikeaId] }), products)).toBe(false);
    expect(cardHasOtherManufacturer(card(1, {}), products)).toBe(false);
  });
});

describe("findOtherManufacturerCardsMissingName", () => {
  it("flags an other-manufacturer card with no, blank or too long a company name", () => {
    const cards = [
      card(1, { selectedInstallOptionIds: [otherId] }),
      card(2, { selectedInstallOptionIds: [otherId], modelNumber: "   " }),
      card(3, { selectedInstallOptionIds: [otherId], modelNumber: "x".repeat(MAX_ITEM_NAME_LENGTH + 1) }),
      card(4, { selectedInstallOptionIds: [otherId], modelNumber: "Hästens" }),
    ];
    expect(findOtherManufacturerCardsMissingName(cards, products)).toEqual([1, 2, 3]);
  });

  it("ignores cards with a named manufacturer or no assembly", () => {
    const cards = [card(1, { selectedInstallOptionIds: [ikeaId] }), card(2, {})];
    expect(findOtherManufacturerCardsMissingName(cards, products)).toEqual([]);
  });
});
