import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { getProductDeliveryType, type ProductDeliveryType } from "@/lib/products/deliveryTypes";

// Whether a product card's "Installation"/"Assembly" step has anything to
// show at all. Some products (e.g. package/pallet catalog items) have no
// install options and no pending-implementation note — for those the whole
// step should disappear rather than show an empty "No installation" radio.
// Doorstep delivery (FIRST_STEP) never offers installation/assembly, so the
// step is hidden for it too.
export function hasInstallStepContent(params: {
  assemblyGroupCount: number;
  typeOptionCount: number;
  hasNeedsImplementationNote: boolean;
  deliveryType: string;
}): boolean {
  if (params.deliveryType === "FIRST_STEP") return false;
  return (
    params.assemblyGroupCount > 0 ||
    params.typeOptionCount > 0 ||
    params.hasNeedsImplementationNote
  );
}

// "No installation" makes no sense on an installation-only card — the whole
// point of that card is the installation.
export function showsNoInstallOption(deliveryType: string): boolean {
  return deliveryType !== "INSTALL_ONLY";
}

// Whether the "Additional services" step has anything to show. Mirrors the
// individual row conditions in WhiteGoodsProductCard — a product with no
// unpacking/dismantling/anchoring/return/pallet-pickup option and not
// furniture must not render an empty step just because a delivery type was
// picked.
export function hasExtrasStepContent(params: {
  showExtras: boolean;
  showReturn: boolean;
  furnitureAddonsVisible: boolean;
  isFurniture: boolean;
  installSelected: boolean;
  hasUnpackingOption: boolean;
  hasDemontOption: boolean;
  hasPalletPickupOption: boolean;
  dismantlingGroupCount: number;
  hasAnchoringOption: boolean;
  hasReturnOption: boolean;
}): boolean {
  const {
    showExtras,
    showReturn,
    furnitureAddonsVisible,
    isFurniture,
    installSelected,
    hasUnpackingOption,
    hasDemontOption,
    hasPalletPickupOption,
    dismantlingGroupCount,
    hasAnchoringOption,
    hasReturnOption,
  } = params;

  return (
    (showExtras && hasUnpackingOption) ||
    (isFurniture && !showExtras && installSelected && hasUnpackingOption) ||
    (showExtras && hasDemontOption) ||
    (showExtras && hasPalletPickupOption) ||
    (dismantlingGroupCount > 0 && furnitureAddonsVisible) ||
    (hasAnchoringOption && furnitureAddonsVisible) ||
    (showReturn && hasReturnOption)
  );
}

// Whether the card offers carry-in. Pallets and half-pallets are doorstep only
// (their INDOOR delivery type is seeded disabled); a product with no INDOOR
// entry stored keeps offering it, as before.
export function offersCarryIn(deliveryTypes: ProductDeliveryType[]): boolean {
  return getProductDeliveryType(deliveryTypes, DELIVERY_TYPES.INDOOR)?.enabled !== false;
}
