import { describe, expect, it } from "vitest";
import { PARCEL_PALLET_PRODUCTS } from "./parcelPalletCatalog";
import { buildDeliveryTypesJson, mergePreservedDeliveryTypes } from "./websiteDeliveryTypes";

function product(code: string) {
  const seed = PARCEL_PALLET_PRODUCTS.find((p) => p.code === code);
  if (!seed) throw new Error(`missing ${code}`);
  return seed;
}

function deliveryType(code: string, key: string) {
  return buildDeliveryTypesJson(product(code)).find((t) => t.key === key)!;
}

const option = (productCode: string, optionCode: string) => product(productCode).options.find((o) => o.code === optionCode);

describe("parcel/pallet prices", () => {
  it("prices a pallet from the PALL S1 / PALLXTRA S1 codes, doorstep only", () => {
    expect(product("PKG_PALL").deliveryTypes.firstStep).toEqual({
      customerPrice: 774,
      subcontractorPrice: 516,
      xtraPrice: 258,
      xtraSubcontractorPrice: 154.8,
    });
    expect(deliveryType("PKG_PALL", "FIRST_STEP")).toMatchObject({ enabled: true, price: "775", subcontractorPrice: "515", xtraPrice: "260" });
    expect(deliveryType("PKG_PALL", "INDOOR").enabled).toBe(false);
  });

  it("prices a half-pallet at 0.75 × a pallet, doorstep only", () => {
    expect(product("PKG_HALVPALL").deliveryTypes.firstStep).toEqual({
      customerPrice: 580.5,
      subcontractorPrice: 387,
      xtraPrice: 193.5,
      xtraSubcontractorPrice: 116.1,
    });
    expect(deliveryType("PKG_HALVPALL", "INDOOR").enabled).toBe(false);
  });

  it("prices envelope, bag and boxes like a standard item, with carry-in", () => {
    for (const code of ["PKG_KONVOLUTT", "PKG_POSE", "PKG_ESKER"]) {
      expect(product(code).deliveryTypes.firstStep).toMatchObject({ customerPrice: 608.88, subcontractorPrice: 402.48, xtraPrice: 154.8 });
      expect(product(code).deliveryTypes.indoor).toMatchObject({ customerPrice: 690.408, subcontractorPrice: 464.4 });
      expect(deliveryType(code, "INDOOR").enabled).toBe(true);
      expect(deliveryType(code, "INSTALL_ONLY").enabled).toBe(false);
    }
  });

  it("charges unpacking 103.20 and taking the empty pallet like a recycling return (258)", () => {
    expect(option("PKG_ESKER", "UNPACKING")).toMatchObject({ customerPrice: 103.2, subcontractorPrice: 51.6 });
    expect(option("PKG_PALL", "PALLET_PICKUP")).toMatchObject({ customerPrice: 258, subcontractorPrice: 154.8 });
  });
});

describe("mergePreservedDeliveryTypes (a reseed of a staff-priced catalog)", () => {
  const seeded = buildDeliveryTypesJson(product("PKG_PALL"));

  it("fills a delivery type still at the 0 kr placeholder, and turns off carry-in", () => {
    const placeholder = seeded.map((t) => ({ ...t, enabled: true, price: "0", subcontractorPrice: "0", xtraPrice: "0", xtraSubcontractorPrice: "0" }));
    const merged = mergePreservedDeliveryTypes(placeholder, seeded);
    expect(merged.find((t) => t.key === "FIRST_STEP")).toMatchObject({ price: "775", subcontractorPrice: "515", xtraPrice: "260" });
    expect(merged.find((t) => t.key === "INDOOR")?.enabled).toBe(false);
  });

  it("keeps a price staff entered", () => {
    const staff = seeded.map((t) => (t.key === "FIRST_STEP" ? { ...t, price: "900", subcontractorPrice: "600" } : t));
    expect(mergePreservedDeliveryTypes(staff, seeded).find((t) => t.key === "FIRST_STEP")).toMatchObject({
      price: "900",
      subcontractorPrice: "600",
    });
  });

  it("uses the seed when nothing usable is stored", () => {
    expect(mergePreservedDeliveryTypes(null, seeded)).toEqual(seeded);
  });
});
