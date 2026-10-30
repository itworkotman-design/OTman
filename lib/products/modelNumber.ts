type ModelNumberProduct = {
  allowModelNumber: boolean;
  allowDeliveryTypes: boolean;
  deliveryTypes: Array<{ key: string; enabled: boolean; allowModelNumber: boolean }>;
};

// With delivery types on, the product-level checkbox is hidden in Edit Prices,
// so only the selected delivery type's flag decides.
export function isModelNumberEnabled(
  product: ModelNumberProduct | null | undefined,
  deliveryType: string,
): boolean {
  if (!product) return false;
  if (!product.allowDeliveryTypes) return product.allowModelNumber;
  const config = product.deliveryTypes.find((dt) => dt.enabled && dt.key === deliveryType);
  return !!config?.allowModelNumber;
}
