import { prisma } from "@/lib/db";
import {
  createDefaultPriceListSettings,
  serializePriceListSettings,
} from "@/lib/products/priceListSettings";
import {
  roundToNearest5,
  WHITE_GOODS_ORDER_LEVEL_EXTRAS,
  type WhiteGoodsProductSeed,
} from "@/lib/content/whiteGoodsElectronics";
import { buildDeliveryTypesJson } from "@/lib/content/websiteDeliveryTypes";

function buildPriceListSettings() {
  const extras = WHITE_GOODS_ORDER_LEVEL_EXTRAS;
  const settings = createDefaultPriceListSettings();
  const setting = (
    extra: { code: string; customerPrice: number; subcontractorPrice: number },
    description: string,
  ) => ({
    code: extra.code,
    description,
    price: String(roundToNearest5(extra.customerPrice)),
    subcontractorPrice: String(roundToNearest5(extra.subcontractorPrice)),
  });

  settings.extraPickup = setting(extras.extraPickup, "Additional pickup / pickup in another store");
  settings.expressDelivery = setting(extras.expressDelivery, "Express delivery under 24h");
  settings.kmFrom21 = setting(extras.kmFrom21, "Per km when distance is over 20 km");
  settings.kmOver100 = setting(extras.kmOver100, "Per km when distance is over 100 km");
  settings.floorSurcharge = setting(extras.floorSurcharge, "Floor surcharge per chargeable floor, no lift");
  return settings;
}

// Seeds one public-website catalog (a dedicated PriceList + its products and
// options) — used by both the white-goods and furniture catalogs. Fully
// separate from DEFAULT/POWER and the internal dashboard's products, so it
// never affects pricing for the internal booking flow. Idempotent
// (upsert-based) and side-effect-free beyond this catalog. The order-level
// fees (express, distance, floor, extra pickup) are the same for every
// website catalog today; the combined website order takes them from the
// first list, so a catalog only needs its own copy to be self-consistent.
export async function seedWebsiteCatalog({
  priceListCode,
  priceListName,
  products,
}: {
  priceListCode: string;
  priceListName: string;
  products: WhiteGoodsProductSeed[];
}) {
  const description = serializePriceListSettings(buildPriceListSettings());

  const priceList = await prisma.priceList.upsert({
    where: { code: priceListCode },
    update: { description },
    create: { name: priceListName, code: priceListCode, description },
  });

  let productsUpserted = 0;
  let optionsUpserted = 0;

  for (const productSeed of products) {
    const deliveryTypes = buildDeliveryTypesJson(productSeed);

    const productData = {
      name: productSeed.nameEn,
      sortOrder: productSeed.sortOrder,
      productType: "PHYSICAL" as const,
      allowDeliveryTypes: true,
      allowInstallOptions: true,
      allowReturnOptions: true,
      allowExtraServices: true,
      allowDemont: true,
      allowQuantity: true,
      allowPeopleCount: false,
      allowHoursInput: false,
      allowModelNumber: true,
      iconKey: productSeed.iconKey ?? null,
      deliveryTypes,
    };

    const product = await prisma.product.upsert({
      where: { code: productSeed.code },
      update: productData,
      create: { ...productData, code: productSeed.code },
    });
    productsUpserted += 1;

    for (const [index, optionSeed] of productSeed.options.entries()) {
      const optionData = {
        label: optionSeed.labelEn,
        description: optionSeed.labelNo,
        descriptionEn: optionSeed.labelEn,
        category: optionSeed.category,
        sortOrder: index + 1,
      };

      const option = await prisma.productOption.upsert({
        where: {
          productId_code: { productId: product.id, code: optionSeed.code },
        },
        update: optionData,
        create: { ...optionData, productId: product.id, code: optionSeed.code },
      });

      const prices = {
        customerPriceCents: Math.round(roundToNearest5(optionSeed.customerPrice) * 100),
        subcontractorPriceCents: Math.round(roundToNearest5(optionSeed.subcontractorPrice) * 100),
      };

      await prisma.priceListItem.upsert({
        where: {
          priceListId_productOptionId: {
            priceListId: priceList.id,
            productOptionId: option.id,
          },
        },
        update: prices,
        create: { ...prices, priceListId: priceList.id, productOptionId: option.id },
      });
      optionsUpserted += 1;
    }
  }

  return { priceListId: priceList.id, productsUpserted, optionsUpserted };
}
