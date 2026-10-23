import { describe, expect, it } from "vitest";
import {
  groupAssemblyOptions,
  groupDismantlingOptions,
  toggleDismantlingSelection,
  toggleDismantlingEnabled,
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
    expect(single.options.map((o) => o.choiceLabel)).toEqual([
      "IKEA",
      "JYSK",
      "Bohus",
      "Skeidar",
      "Other manufacturer",
    ]);
    expect(single.options[0].option.id).toBe("ASM_SGL_BED_IKEA");
    expect(single.options[0].option.customerPrice).toBe("856");
  });

  it("gives each type a 'from' price — its cheapest manufacturer", () => {
    expect(groups[0].fromPrice).toBe(856);
  });

  it("uses Norwegian labels for the type and manufacturer in no", () => {
    const no = groupAssemblyOptions(bed.options, seeds, "no");
    expect(no[0].label).toBe("Enkeltseng");
    expect(no[0].options.at(-1)!.choiceLabel).not.toBe("Other manufacturer");
  });

  it("groups the TV's install types by where it goes, each offering its sizes", () => {
    const tv = catalogProductFromSeed("WG_TV");
    const tvGroups = groupAssemblyOptions(tv.options, buildOptionSeedMap("WG_TV"), "en");
    expect(tvGroups.map((g) => g.label)).toEqual(["Wall mount", "On TV bench / table", "On a stand"]);
    expect(tvGroups.map((g) => g.choiceKind)).toEqual(["size", "size", "size"]);
    expect(tvGroups[0].options.map((o) => o.choiceLabel)).toEqual(['Under 55"', '55"–74"', '75"–100"']);
    expect(tvGroups[2].options.map((o) => o.option.code)).toEqual(["TV_MOUNT_STAND_75_100"]);
    expect(groupAssemblyOptions(tv.options, buildOptionSeedMap("WG_TV"), "no").map((g) => g.label)).toEqual([
      "Veggmontering",
      "På TV-benk / bord",
      "På stativ",
    ]);
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
      DISMANTLE_DISP_STD: "DISMANTLE_DISPOSAL_STANDARD",
      DISMANTLE_CAR_STD: "DISMANTLE_CAREFUL_STANDARD",
    };
    const old = bed.options.map((o) => ({ ...o, code: longCodes[o.code] ?? o.code }));
    const pair = groupDismantlingOptions(old, "en")[0];
    expect(pair?.disposal?.code).toBe("DISMANTLE_DISPOSAL_STANDARD");
    expect(pair?.careful?.code).toBe("DISMANTLE_CAREFUL_STANDARD");

    const oldAssembly = bed.options.map((o) => (o.code === "ASM_SGL_BED_IKEA" ? { ...o, code: "ASM_SINGLE_BED_IKEA" } : o));
    expect(groupAssemblyOptions(oldAssembly, seeds, "en")[0]?.options[0]?.option.code).toBe("ASM_SINGLE_BED_IKEA");
  });

  it("pairs the one for-disposal and one for-reuse option", () => {
    expect(groups).toHaveLength(1);
    const [pair] = groups;
    expect(pair.disposal?.id).toBe("DISMANTLE_DISP_STD");
    expect(pair.careful?.id).toBe("DISMANTLE_CAR_STD");
    expect(pair.disposal?.customerPrice).toBe("480");
    expect(pair.careful?.customerPrice).toBe("720");
  });

  it("returns nothing for a product without dismantling, e.g. a chair", () => {
    expect(groupDismantlingOptions(catalogProductFromSeed("FN_CHAIR").options, "en")).toEqual([]);
  });
});

describe("toggleDismantlingSelection", () => {
  const groups = groupDismantlingOptions(bed.options, "en");

  it("allows one dismantling choice per item: picking the other variant replaces it", () => {
    expect(toggleDismantlingSelection(["WALL_ANCHORING"], groups, "DISMANTLE_DISP_STD")).toEqual([
      "WALL_ANCHORING",
      "DISMANTLE_DISP_STD",
    ]);
    expect(toggleDismantlingSelection(["DISMANTLE_DISP_STD", "WALL_ANCHORING"], groups, "DISMANTLE_CAR_STD")).toEqual([
      "WALL_ANCHORING",
      "DISMANTLE_CAR_STD",
    ]);
  });

  it("clears the choice when it is picked again", () => {
    expect(toggleDismantlingSelection(["DISMANTLE_CAR_STD", "WALL_ANCHORING"], groups, "DISMANTLE_CAR_STD")).toEqual([
      "WALL_ANCHORING",
    ]);
  });
});

describe("toggleDismantlingEnabled", () => {
  const groups = groupDismantlingOptions(bed.options, "en");

  it("ticking the dismantling checkbox starts on for disposal", () => {
    expect(toggleDismantlingEnabled(["WALL_ANCHORING"], groups)).toEqual(["WALL_ANCHORING", "DISMANTLE_DISP_STD"]);
    expect(toggleDismantlingEnabled([], [])).toEqual([]);
  });

  it("unticking it clears whichever variant is picked", () => {
    expect(toggleDismantlingEnabled(["DISMANTLE_CAR_STD", "WALL_ANCHORING"], groups)).toEqual(["WALL_ANCHORING"]);
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
