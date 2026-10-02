import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { roundToNearest5, type WhiteGoodsProductSeed } from "@/lib/content/whiteGoodsElectronics";

// "Installation only" is still a trip to the customer: one flat price for
// every product, deliberately not rounded to 5 kr. The subcontractor share
// follows the doorstep delivery's (402.48 → 400). Editable per product in
// Booking → Edit prices after seeding.
export const INSTALL_ONLY_VISIT_PRICE = { customerPrice: 609, subcontractorPrice: 400 };

// The Product.deliveryTypes JSON a website catalog product is seeded with
// (prices rounded to 5 kr). Pure — no database — so tests can build the same
// catalog product the seed writes.
export function buildDeliveryTypesJson(product: Pick<WhiteGoodsProductSeed, "deliveryTypes">) {
  const { firstStep, indoor, installOnlyEnabled } = product.deliveryTypes;

  return [
    {
      key: DELIVERY_TYPES.FIRST_STEP,
      enabled: true,
      code: "FIRST_STEP",
      label: "Delivery to doorstep",
      price: String(roundToNearest5(firstStep.customerPrice)),
      subcontractorPrice: String(roundToNearest5(firstStep.subcontractorPrice)),
      xtraPrice: String(roundToNearest5(firstStep.xtraPrice)),
      xtraSubcontractorPrice: String(roundToNearest5(firstStep.xtraSubcontractorPrice)),
      allowInstallOptions: true,
      allowExtraServices: true,
      allowReturnOptions: true,
      allowModelNumber: true,
    },
    {
      key: DELIVERY_TYPES.INDOOR,
      enabled: true,
      code: "INDOOR",
      label: "Delivery with carry-in",
      price: String(roundToNearest5(indoor.customerPrice)),
      subcontractorPrice: String(roundToNearest5(indoor.subcontractorPrice)),
      xtraPrice: String(roundToNearest5(indoor.xtraPrice)),
      xtraSubcontractorPrice: String(roundToNearest5(indoor.xtraSubcontractorPrice)),
      allowInstallOptions: true,
      allowExtraServices: true,
      allowReturnOptions: true,
      allowModelNumber: true,
    },
    {
      // The extra rate is 0 — an install-only item that isn't the order's
      // full-price card is free (see websiteInstallOnlyVisit.ts).
      key: DELIVERY_TYPES.INSTALL_ONLY,
      enabled: installOnlyEnabled,
      code: "INSTALL_ONLY",
      label: "Installation only",
      price: String(INSTALL_ONLY_VISIT_PRICE.customerPrice),
      subcontractorPrice: String(INSTALL_ONLY_VISIT_PRICE.subcontractorPrice),
      xtraPrice: "0",
      xtraSubcontractorPrice: "0",
      allowInstallOptions: true,
      allowExtraServices: true,
      allowReturnOptions: true,
      allowModelNumber: true,
    },
    {
      key: DELIVERY_TYPES.RETURN_ONLY,
      enabled: true,
      code: "RETURN_ONLY",
      label: "Return only",
      price: "0",
      subcontractorPrice: "0",
      xtraPrice: "0",
      xtraSubcontractorPrice: "0",
      allowInstallOptions: false,
      allowExtraServices: false,
      allowReturnOptions: true,
      allowModelNumber: true,
    },
  ];
}
