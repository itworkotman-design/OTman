import { prisma } from "@/lib/db";
import { getProductConfigMap, type ProductConfig } from "@/lib/products/productConfig";

// A delivery-only product (e.g. parcel/pallet) has no ProductOption, so it has
// no PriceListItem either — its prices live in Product.deliveryTypes. The
// price-list editor builds its rows from PriceListItems, so these are linked
// to their list through PriceListProduct and loaded separately here.
export type DeliveryOnlyProduct = Omit<ProductConfig, "id"> & {
  productId: string;
  productName: string;
  productCode: string;
};

export async function getDeliveryOnlyProducts(
  priceListId: string,
): Promise<DeliveryOnlyProduct[]> {
  const links = await prisma.priceListProduct.findMany({
    where: { priceListId },
    select: { product: { select: { id: true, name: true, code: true } } },
    orderBy: { product: { sortOrder: "asc" } },
  });

  const configMap = await getProductConfigMap(links.map((link) => link.product.id));

  return links.flatMap(({ product }) => {
    const config = configMap.get(product.id);
    if (!config) return [];

    const { id: _id, ...rest } = config;
    return [{ ...rest, productId: product.id, productName: product.name, productCode: product.code }];
  });
}
