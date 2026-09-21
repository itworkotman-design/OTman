import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { createDefaultProductAutoDeliveryPrice } from "@/lib/products/autoDeliveryPrice";
import { buildDeliveryTypesJson } from "@/lib/content/websiteDeliveryTypes";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import { roundToNearest5 } from "@/lib/content/whiteGoodsElectronics";

// Test helper: builds the CatalogProduct the website catalog API would return
// for a seeded product (5 kr-rounded prices, ids = option codes), so pricing
// tests run against the real seed data without a database.
export function catalogProductFromSeed(productCode: string): CatalogProduct {
  const seed = findWebsiteProductSeed(productCode);
  if (!seed) throw new Error(`No website seed for ${productCode}`);

  return {
    id: seed.code,
    code: seed.code,
    label: seed.nameEn,
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
    deliveryTypes: buildDeliveryTypesJson(seed) as CatalogProduct["deliveryTypes"],
    customSections: [],
    options: seed.options.map((option) => {
      const price = String(roundToNearest5(option.customerPrice));
      return {
        id: option.code,
        code: option.code,
        label: option.labelEn,
        description: option.labelNo,
        category: option.category,
        customerPrice: price,
        subcontractorPrice: String(roundToNearest5(option.subcontractorPrice)),
        effectiveCustomerPrice: price,
        active: true,
      };
    }),
  };
}
