import type {
  SavedProductCard,
  WordpressImportReadOnlySnapshot,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type {
  CalculatedLine,
  PriceLookup,
  ProductBreakdown,
} from "@/lib/booking/pricing/types";

export function getWordpressReadOnlyTotalCents(
  snapshot: WordpressImportReadOnlySnapshot | null | undefined,
) {
  return (
    snapshot?.rows.reduce(
      (sum, row) => sum + Math.round(row.priceCents * row.quantity),
      0,
    ) ?? 0
  );
}

export function getNativeBreakdownTotalsCents(
  breakdown: ProductBreakdown,
  priceLookup: PriceLookup,
) {
  let customerTotalCents = 0;
  let subcontractorTotalCents = 0;

  for (const item of breakdown.items) {
    if (item.kind === "deliveryType") {
      customerTotalCents += Math.round(item.unitPrice * item.qty * 100);
      subcontractorTotalCents += Math.round(
        item.subcontractorUnitPrice * item.qty * 100,
      );
      continue;
    }

    if (item.kind === "customPrice") {
      customerTotalCents += Math.round(item.unitPrice * item.qty * 100);
      subcontractorTotalCents += Math.round(
        (item.subcontractorUnitPrice ?? 0) * item.qty * 100,
      );
      continue;
    }

    if (item.kind === "info") {
      continue;
    }

    const lookup = priceLookup[item.productOptionId];

    if (!lookup) {
      continue;
    }

    const customerUnitPrice =
      item.priceOverride !== undefined
        ? item.priceOverride
        : lookup.customerPrice;

    customerTotalCents += Math.round(customerUnitPrice * item.qty * 100);
    subcontractorTotalCents += Math.round(
      lookup.subcontractorPrice * item.qty * 100,
    );
  }

  return {
    customerTotalCents,
    subcontractorTotalCents,
  };
}

export function wordpressReadOnlyRowsMatchNativeLines(
  snapshot: WordpressImportReadOnlySnapshot | null | undefined,
  nativeLines: CalculatedLine[],
) {
  if (!snapshot) {
    return false;
  }

  const remainingNativeTotals = nativeLines
    .map((line) => Math.round(line.lineTotal * 100))
    .filter((totalCents) => totalCents !== 0);

  for (const row of snapshot.rows) {
    const rowTotalCents = Math.round(row.priceCents * row.quantity);

    if (rowTotalCents === 0) {
      continue;
    }

    const exactIndex = remainingNativeTotals.findIndex(
      (totalCents) => totalCents === rowTotalCents,
    );

    if (exactIndex >= 0) {
      remainingNativeTotals.splice(exactIndex, 1);
      continue;
    }

    const splitMatchIndexes: number[] = [];
    let splitMatchTotal = 0;

    for (let index = 0; index < remainingNativeTotals.length; index += 1) {
      splitMatchIndexes.push(index);
      splitMatchTotal += remainingNativeTotals[index];

      if (splitMatchTotal >= rowTotalCents) {
        break;
      }
    }

    if (splitMatchTotal !== rowTotalCents) {
      return false;
    }

    for (const index of splitMatchIndexes.toReversed()) {
      remainingNativeTotals.splice(index, 1);
    }
  }

  return remainingNativeTotals.length === 0;
}

export function shouldClearWordpressImportReadOnly(params: {
  card: SavedProductCard;
  breakdown: ProductBreakdown;
  nativeLines: CalculatedLine[];
  priceLookup: PriceLookup;
}) {
  const { card, breakdown, nativeLines, priceLookup } = params;
  const snapshot = card.wordpressImportReadOnly;

  if (!snapshot) {
    return false;
  }

  const wordpressCustomerTotalCents = getWordpressReadOnlyTotalCents(snapshot);
  const nativeTotals = getNativeBreakdownTotalsCents(breakdown, priceLookup);

  if (nativeTotals.customerTotalCents !== wordpressCustomerTotalCents) {
    return false;
  }

  if (
    card.pricingSnapshot == null &&
    typeof snapshot.subcontractorTotalCents === "number"
  ) {
    return (
      nativeTotals.subcontractorTotalCents === snapshot.subcontractorTotalCents
    );
  }

  return wordpressReadOnlyRowsMatchNativeLines(snapshot, nativeLines);
}
