// Whether a product card's "Installation"/"Assembly" step has anything to
// show at all. Some products (e.g. package/pallet catalog items) have no
// install options and no pending-implementation note — for those the whole
// step should disappear rather than show an empty "No installation" radio.
export function hasInstallStepContent(params: {
  assemblyGroupCount: number;
  typeOptionCount: number;
  hasNeedsImplementationNote: boolean;
}): boolean {
  return (
    params.assemblyGroupCount > 0 ||
    params.typeOptionCount > 0 ||
    params.hasNeedsImplementationNote
  );
}

// Whether the "Additional services" step has anything to show. Mirrors the
// individual row conditions in WhiteGoodsProductCard — a product with no
// unpacking/dismantling/anchoring/return option and not furniture must not
// render an empty step just because a delivery type was picked.
export function hasExtrasStepContent(params: {
  showExtras: boolean;
  showReturn: boolean;
  furnitureAddonsVisible: boolean;
  isFurniture: boolean;
  installSelected: boolean;
  hasUnpackingOption: boolean;
  hasDemontOption: boolean;
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
    dismantlingGroupCount,
    hasAnchoringOption,
    hasReturnOption,
  } = params;

  return (
    (showExtras && hasUnpackingOption) ||
    (isFurniture && !showExtras && installSelected && hasUnpackingOption) ||
    (showExtras && hasDemontOption) ||
    (dismantlingGroupCount > 0 && furnitureAddonsVisible) ||
    (hasAnchoringOption && furnitureAddonsVisible) ||
    (showReturn && hasReturnOption)
  );
}
