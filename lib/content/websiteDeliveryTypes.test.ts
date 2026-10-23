import { describe, expect, it } from "vitest";
import { buildDeliveryTypesJson } from "./websiteDeliveryTypes";
import { findWebsiteProductSeed } from "./websiteCatalogs";

// "Installation only" is still a trip to the customer: one flat 608 kr for
// every product (760 kr incl. VAT, just under doorstep's 616; editable per
// product afterwards). Its extra rate stays 0: an install-only item that isn't the order's
// full-price card is free.
function installOnly(code: string) {
  const seed = findWebsiteProductSeed(code);
  if (!seed) throw new Error(`missing seed ${code}`);
  return buildDeliveryTypesJson(seed).find((t) => t.key === "INSTALL_ONLY");
}

describe("buildDeliveryTypesJson — installation only", () => {
  it("seeds a flat 608 kr (ends in 0 incl. VAT) with a 0 extra rate", () => {
    expect(installOnly("WG_DISHWASHER")).toMatchObject({
      price: "608",
      subcontractorPrice: "400",
      xtraPrice: "0",
      xtraSubcontractorPrice: "0",
    });
  });

  it("is the same 608 kr for larger items and furniture", () => {
    expect(installOnly("WG_SIDE_BY_SIDE_FRIDGE")?.price).toBe("608");
    expect(installOnly("FN_SOFA")?.price).toBe("608");
  });
});
