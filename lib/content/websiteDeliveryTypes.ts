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
  const { firstStep, indoor, installOnlyEnabled, indoorEnabled = true } = product.deliveryTypes;

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
      enabled: indoorEnabled,
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

type DeliveryTypeEntry = ReturnType<typeof buildDeliveryTypesJson>[number];
const PRICE_FIELDS = ["price", "subcontractorPrice", "xtraPrice", "xtraSubcontractorPrice"] as const;

// A reseed of a catalog whose prices staff own (preservePricesOnReseed):
// prices staff entered are kept; a delivery type still at the 0 kr
// placeholder gets the seed's prices. A delivery type the seed turns off
// (a pallet's carry-in) is turned off; one staff turned off stays off.
export function mergePreservedDeliveryTypes(stored: unknown, seeded: DeliveryTypeEntry[]): DeliveryTypeEntry[] {
  if (!Array.isArray(stored)) return seeded;
  const byKey = new Map(
    stored
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && typeof (entry as { key?: unknown }).key === "string")
      .map((entry) => [entry.key as string, entry]),
  );
  return seeded.map((seed) => {
    const existing = byKey.get(seed.key);
    if (!existing) return seed;
    const isPlaceholder = PRICE_FIELDS.every((field) => !Number(existing[field] ?? 0));
    return {
      ...seed,
      ...existing,
      ...(isPlaceholder ? Object.fromEntries(PRICE_FIELDS.map((field) => [field, seed[field]])) : {}),
      enabled: existing.enabled !== false && seed.enabled,
    } as DeliveryTypeEntry;
  });
}
