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

function buildPriceListSettings(deliveryOnly: boolean) {
  const extras = WHITE_GOODS_ORDER_LEVEL_EXTRAS;
  const settings = createDefaultPriceListSettings();
  settings.deliveryOnly = deliveryOnly;
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
  preservePricesOnReseed = false,
  deliveryOnly = false,
}: {
  priceListCode: string;
  priceListName: string;
  products: WhiteGoodsProductSeed[];
  // A delivery-only catalog (e.g. parcel/pallet): its products have no
  // options, and the editor adds new ones the same way — see
  // PriceListSettings.deliveryOnly.
  deliveryOnly?: boolean;
  // White goods/furniture want the opposite of this (the default): their
  // prices come from a spreadsheet and are meant to be refreshed by
  // reseeding. A catalog whose prices are instead staff-entered via
  // /dashboard/booking/editPrices (e.g. parcel/pallet — see
  // seedParcelPalletCatalog.ts) must never have a reseed silently reset
  // those back to this seed's own (placeholder) values.
  preservePricesOnReseed?: boolean;
}) {
  const description = serializePriceListSettings(buildPriceListSettings(deliveryOnly));

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

    // deliveryTypes carries prices (per-product, JSON — see
    // Product.deliveryTypes), same as PriceListItem does for options below.
    // A delivery-only product (no options — e.g. parcel/pallet) has NO
    // PriceListItem rows at all, so this is the only place its price lives;
    // must be excluded from the update just like PriceListItem prices are.
    const { deliveryTypes: _deliveryTypes, ...productDataWithoutPrices } = productData;
    const product = await prisma.product.upsert({
      where: { code: productSeed.code },
      update: preservePricesOnReseed ? productDataWithoutPrices : productData,
      create: { ...productData, code: productSeed.code },
    });
    productsUpserted += 1;

    // With no options there's no PriceListItem to tie the product to this
    // list, so link it explicitly (the editor lists it from this link).
    if (productSeed.options.length === 0) {
      await prisma.priceListProduct.upsert({
        where: { priceListId_productId: { priceListId: priceList.id, productId: product.id } },
        update: {},
        create: { priceListId: priceList.id, productId: product.id },
      });
    }

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
        update: preservePricesOnReseed || optionSeed.staffPriced ? {} : prices,
        create: { ...prices, priceListId: priceList.id, productOptionId: option.id },
      });
      optionsUpserted += 1;
    }
  }

  return { priceListId: priceList.id, productsUpserted, optionsUpserted };
}
