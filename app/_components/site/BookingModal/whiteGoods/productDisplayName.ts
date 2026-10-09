import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { isSizePricedProduct } from "@/lib/booking/pricing/sizeBrackets";

// A size-priced catch-all product ("Other furniture") is titled in the
// calculator with what the customer said it is, behind a short prefix:
// "A.M: Fish" (A.M = Andre møbler). Any other size-priced product falls back to
// its own label as the prefix. The prefix is not translated on purpose.
const NAME_PREFIX_BY_PRODUCT_CODE: Record<string, string> = {
  FN_OTHER_FURNITURE: "A.M",
};

// The title a product gets in the order calculator (sidebar and final
// summary). `label` is the product's normal, localized label — used until a
// name is typed and for every ordinary product.
export function getCalculatorProductName({
  product,
  itemName,
  label,
}: {
  product: CatalogProduct;
  itemName: string | null | undefined;
  label: string;
}): string {
  const name = typeof itemName === "string" ? itemName.trim() : "";
  if (!name || !isSizePricedProduct(product)) return label;

  return `${NAME_PREFIX_BY_PRODUCT_CODE[product.code] ?? label}: ${name}`;
}

// The customer-facing order summary spells it out instead of the "A.M:"
// shorthand: the item's own name as the title, the product label under it.
export function getSummaryProductTitle({
  product,
  itemName,
  label,
}: {
  product: CatalogProduct;
  itemName: string | null | undefined;
  label: string;
}): { name: string; subtitle: string | null } {
  const name = typeof itemName === "string" ? itemName.trim() : "";
  if (!name || !isSizePricedProduct(product)) return { name: label, subtitle: null };

  return { name, subtitle: label };
}
