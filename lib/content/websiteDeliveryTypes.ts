import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { roundToNearest5, type WhiteGoodsProductSeed } from "@/lib/content/whiteGoodsElectronics";

// The Product.deliveryTypes JSON a website catalog product is seeded with
// (prices rounded to 5 kr). Pure — no database — so tests can build the same
// catalog product the seed writes.
export function buildDeliveryTypesJson(product: WhiteGoodsProductSeed) {
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
      key: DELIVERY_TYPES.INSTALL_ONLY,
      enabled: installOnlyEnabled,
      code: "INSTALL_ONLY",
      label: "Installation only",
      price: "0",
      subcontractorPrice: "0",
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
