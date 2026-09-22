import { prisma } from "@/lib/db";
import { MOVING_PRICE_LIST_CODE, MOVING_PRODUCT_CODE, MOVING_SIZE_OPTIONS } from "@/lib/content/movingCatalog";

// Seeds the website Moving catalog on its own WEBSITE_MOVING price list — a
// single bare product with one option per size bracket, each carrying a flat
// price. Deliberately NOT built on seedWebsiteCatalog: that helper (and the
// WhiteGoodsProductSeed/FurnitureProductSeed shape it takes) always builds a
// delivery-type + install-option + extras product, which doesn't fit a flat
// "pick one bracket" price at all. Run standalone via
// `npm run seed:moving-catalog` — not part of prisma/seed.ts's main().
//
// Unlike the white-goods/furniture seeds (whose prices come from a
// spreadsheet and are meant to be refreshed by reseeding), Moving's prices
// are meant to be entered and maintained by staff via
// /dashboard/booking/editPrices, not by this file — so price list item
// prices are only ever set on first create, never touched on update. See
// docs/homepage-ordering-roadmap.md §6/§4 progress log.
export async function seedMovingCatalog() {
  const priceList = await prisma.priceList.upsert({
    where: { code: MOVING_PRICE_LIST_CODE },
    update: {},
    create: { name: "Website — Moving", code: MOVING_PRICE_LIST_CODE },
  });

  const productData = {
    name: "Moving (by size)",
    sortOrder: 1,
    productType: "PHYSICAL" as const,
    allowDeliveryTypes: false,
    allowInstallOptions: false,
    allowReturnOptions: false,
    allowExtraServices: false,
    allowDemont: false,
    allowQuantity: false,
    allowPeopleCount: false,
    allowHoursInput: false,
    allowModelNumber: false,
  };

  const product = await prisma.product.upsert({
    where: { code: MOVING_PRODUCT_CODE },
    update: productData,
    create: { ...productData, code: MOVING_PRODUCT_CODE },
  });

  let optionsUpserted = 0;

  for (const [index, optionSeed] of MOVING_SIZE_OPTIONS.entries()) {
    const optionData = {
      label: optionSeed.labelEn,
      description: optionSeed.labelNo,
      descriptionEn: optionSeed.labelEn,
      category: "size",
      sortOrder: index + 1,
    };

    const option = await prisma.productOption.upsert({
      where: { productId_code: { productId: product.id, code: optionSeed.code } },
      update: optionData,
      create: { ...optionData, productId: product.id, code: optionSeed.code },
    });

    await prisma.priceListItem.upsert({
      where: {
        priceListId_productOptionId: {
          priceListId: priceList.id,
          productOptionId: option.id,
        },
      },
      // Never overwrite an existing row's price on reseed — see file comment.
      update: {},
      create: {
        priceListId: priceList.id,
        productOptionId: option.id,
        customerPriceCents: Math.round(optionSeed.customerPrice * 100),
        subcontractorPriceCents: Math.round(optionSeed.subcontractorPrice * 100),
      },
    });
    optionsUpserted += 1;
  }

  return { priceListId: priceList.id, productId: product.id, optionsUpserted };
}
