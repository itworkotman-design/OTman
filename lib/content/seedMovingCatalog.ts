import { prisma } from "@/lib/db";
import {
  MOVING_CARRY_SURCHARGE_OPTIONS,
  MOVING_CARRY_SURCHARGE_PRODUCT_CODE,
  MOVING_FLOOR_SURCHARGE_OPTION,
  MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
  MOVING_PRICE_LIST_CODE,
  MOVING_PRODUCT_CODE,
  MOVING_SERVICES_PRODUCT_CODE,
  MOVING_SERVICE_OPTIONS,
  MOVING_SIZE_OPTIONS,
  type MovingSizeOptionSeed,
} from "@/lib/content/movingCatalog";

// Seeds the website Moving catalog on its own WEBSITE_MOVING price list — a
// bare product with one option per size bracket, plus a second bare product
// for the optional additional services (Nedpakking, Flyttevask), each
// option carrying a flat price. Deliberately NOT built
// on seedWebsiteCatalog: that helper (and the
// WhiteGoodsProductSeed/FurnitureProductSeed shape it takes) always builds a
// delivery-type + install-option + extras product, which doesn't fit a flat
// "pick one bracket" price at all. Run standalone via
// `npm run seed:moving-catalog` — not part of prisma/seed.ts's main().
//
// Unlike the white-goods/furniture seeds (whose prices come from a
// spreadsheet and are meant to be refreshed by reseeding), Moving's prices
// are meant to be entered and maintained by staff via
// /dashboard/booking/editPrices, not by this file — so price list item
// prices are only ever set on first create (or filled into a row still at
// the old 0 kr placeholder), never over a price staff have set. See
// docs/homepage-ordering-roadmap.md §6/§4 progress log.
export async function seedMovingCatalog() {
  const priceList = await prisma.priceList.upsert({
    where: { code: MOVING_PRICE_LIST_CODE },
    update: {},
    create: { name: "Website — Moving", code: MOVING_PRICE_LIST_CODE },
  });

  const sizes = await seedFlatProduct(priceList.id, {
    code: MOVING_PRODUCT_CODE,
    name: "Moving (by size)",
    sortOrder: 1,
    category: "size",
    options: MOVING_SIZE_OPTIONS,
  });

  const services = await seedFlatProduct(priceList.id, {
    code: MOVING_SERVICES_PRODUCT_CODE,
    name: "Moving — additional services",
    sortOrder: 2,
    category: "service",
    options: MOVING_SERVICE_OPTIONS,
  });

  await seedFlatProduct(priceList.id, {
    code: MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
    name: "Moving — floor surcharge",
    sortOrder: 3,
    category: "surcharge",
    options: [MOVING_FLOOR_SURCHARGE_OPTION],
  });

  await seedFlatProduct(priceList.id, {
    code: MOVING_CARRY_SURCHARGE_PRODUCT_CODE,
    name: "Moving — carrying distance",
    sortOrder: 4,
    category: "surcharge",
    options: MOVING_CARRY_SURCHARGE_OPTIONS,
  });

  return {
    priceListId: priceList.id,
    productId: sizes.productId,
    optionsUpserted: sizes.optionsUpserted,
    servicesProductId: services.productId,
    servicesUpserted: services.optionsUpserted,
  };
}

async function seedFlatProduct(
  priceListId: string,
  seed: { code: string; name: string; sortOrder: number; category: string; options: MovingSizeOptionSeed[] },
) {
  const productData = {
    name: seed.name,
    sortOrder: seed.sortOrder,
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
    where: { code: seed.code },
    update: productData,
    create: { ...productData, code: seed.code },
  });

  let optionsUpserted = 0;

  for (const [index, optionSeed] of seed.options.entries()) {
    const optionData = {
      label: optionSeed.labelEn,
      description: optionSeed.labelNo,
      descriptionEn: optionSeed.labelEn,
      category: seed.category,
      isActive: true,
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
          priceListId,
          productOptionId: option.id,
        },
      },
      // Never overwrite an existing row's price on reseed — see file comment.
      update: {},
      create: {
        priceListId,
        productOptionId: option.id,
        customerPriceCents: Math.round(optionSeed.customerPrice * 100),
        subcontractorPriceCents: Math.round(optionSeed.subcontractorPrice * 100),
      },
    });
    // A row seeded before there were starting prices sits at the 0 kr
    // placeholder: fill it in. The `customerPriceCents: 0` match means a
    // price staff have entered is never overwritten.
    await prisma.priceListItem.updateMany({
      where: { priceListId, productOptionId: option.id, customerPriceCents: 0 },
      data: { customerPriceCents: Math.round(optionSeed.customerPrice * 100) },
    });
    optionsUpserted += 1;
  }

  // Options dropped from the code (e.g. Mellomlagring) are deactivated, not
  // deleted — past orders keep pointing at them, and getMovingCatalog only
  // lists active options, so a reseed is enough to take one off the site.
  await prisma.productOption.updateMany({
    where: { productId: product.id, code: { notIn: seed.options.map((o) => o.code) } },
    data: { isActive: false },
  });

  return { productId: product.id, optionsUpserted };
}
