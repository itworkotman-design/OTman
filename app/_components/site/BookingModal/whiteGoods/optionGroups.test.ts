import { describe, expect, it } from "vitest";
import {
  groupAssemblyOptions,
  groupDismantlingOptions,
  buildOptionSeedMap,
  pickDefaultInstallOptionId,
} from "./optionGroups";
import { catalogProductFromSeed } from "@/lib/content/websiteCatalogFixtures";

const bed = catalogProductFromSeed("FN_BED");
const seeds = buildOptionSeedMap("FN_BED");

describe("groupAssemblyOptions", () => {
  const groups = groupAssemblyOptions(bed.options, seeds, "en");

  it("groups the type + manufacturer combinations by type, in source order", () => {
    expect(groups.map((g) => g.label)).toEqual([
      "Single bed",
      "Double bed",
      "Continental bed",
      "Bunk / family bed",
      "Daybed",
    ]);
    expect(groups.every((g) => g.options.length === 5)).toBe(true);
  });

  it("lists the manufacturers within a type with their own option and price", () => {
    const single = groups[0];
    expect(single.options.map((o) => o.manufacturerLabel)).toEqual([
      "IKEA",
      "JYSK",
      "Bohus",
      "Skeidar",
      "Other manufacturer",
    ]);
    expect(single.options[0].option.id).toBe("ASM_SGL_BED_IKEA");
    expect(single.options[0].option.customerPrice).toBe("850");
  });

  it("gives each type a 'from' price — its cheapest manufacturer", () => {
    expect(groups[0].fromPrice).toBe(850);
  });

  it("uses Norwegian labels for the type and manufacturer in no", () => {
    const no = groupAssemblyOptions(bed.options, seeds, "no");
    expect(no[0].label).toBe("Enkeltseng");
    expect(no[0].options.at(-1)!.manufacturerLabel).not.toBe("Other manufacturer");
  });

  it("returns nothing for a product without type/manufacturer options (white goods, Other furniture)", () => {
    const wg = catalogProductFromSeed("WG_DISHWASHER");
    expect(groupAssemblyOptions(wg.options, buildOptionSeedMap("WG_DISHWASHER"), "en")).toEqual([]);
    const other = catalogProductFromSeed("FN_OTHER_FURNITURE");
    expect(groupAssemblyOptions(other.options, buildOptionSeedMap("FN_OTHER_FURNITURE"), "en")).toEqual([]);
  });
});

describe("groupDismantlingOptions", () => {
  const groups = groupDismantlingOptions(bed.options, "en");

  it("pairs options still stored under the old long codes (before a reseed) the same way", () => {
    const longCodes: Record<string, string> = {
      DISMANTLE_DISP_SGL_BED: "DISMANTLE_DISPOSAL_SINGLE_BED",
      DISMANTLE_CAR_SGL_BED: "DISMANTLE_CAREFUL_SINGLE_BED",
    };
    const old = bed.options.map((o) => ({ ...o, code: longCodes[o.code] ?? o.code }));
    const single = groupDismantlingOptions(old, "en")[0];
    expect(single?.disposal?.code).toBe("DISMANTLE_DISPOSAL_SINGLE_BED");
    expect(single?.careful?.code).toBe("DISMANTLE_CAREFUL_SINGLE_BED");

    const oldAssembly = bed.options.map((o) => (o.code === "ASM_SGL_BED_IKEA" ? { ...o, code: "ASM_SINGLE_BED_IKEA" } : o));
    expect(groupAssemblyOptions(oldAssembly, seeds, "en")[0]?.options[0]?.option.code).toBe("ASM_SINGLE_BED_IKEA");
  });

  it("pairs the for-disposal and careful-for-reuse variants per type", () => {
    expect(groups.map((g) => g.label)).toEqual([
      "Single bed",
      "Double bed",
      "Continental bed",
      "Bunk / family bed",
      "Daybed",
    ]);
    const single = groups[0];
    expect(single.disposal?.id).toBe("DISMANTLE_DISP_SGL_BED");
    expect(single.careful?.id).toBe("DISMANTLE_CAR_SGL_BED");
    expect(single.disposal?.customerPrice).toBe("400");
    expect(single.careful?.customerPrice).toBe("650");
  });

  it("returns nothing for a product without dismantling, e.g. a chair", () => {
    expect(groupDismantlingOptions(catalogProductFromSeed("FN_CHAIR").options, "en")).toEqual([]);
  });

  it("uses Norwegian type labels in no", () => {
    expect(groupDismantlingOptions(bed.options, "no")[0].label).toBe("Enkeltseng");
  });
});

// Picking "Installation only" auto-selects the first installation option the
// card shows, so the card can never be "installation only" with nothing to
// install.
describe("pickDefaultInstallOptionId", () => {
  it("picks the first assembly type's first manufacturer for furniture", () => {
    const groups = groupAssemblyOptions(bed.options, seeds, "en");
    expect(pickDefaultInstallOptionId({ assemblyGroups: groups, typeOptions: [] })).toBe(groups[0].options[0].option.id);
  });

  it("picks the first install type for white goods", () => {
    const dishwasher = catalogProductFromSeed("WG_DISHWASHER");
    const typeOptions = dishwasher.options.filter((o) => o.category === "install").slice(0, 2);
    expect(pickDefaultInstallOptionId({ assemblyGroups: [], typeOptions })).toBe(typeOptions[0].id);
  });

  it("is null when there's nothing to pick", () => {
    expect(pickDefaultInstallOptionId({ assemblyGroups: [], typeOptions: [] })).toBeNull();
  });
});
