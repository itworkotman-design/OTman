import { prisma } from "@/lib/db";
import {
  createDefaultPriceListSettings,
  createDefaultWeightClassPricing,
  serializePriceListSettings,
} from "@/lib/products/priceListSettings";
import { WEIGHT_CLASSES } from "@/lib/products/weightClass";
import {
  FLOOR_SURCHARGE_PARTNER_SHARE,
  RETURN_PARTNER_SHARE,
  WEIGHT_CLASS_FLOOR_SURCHARGE,
  WEIGHT_CLASS_RETURN_PRICE,
  type WeightClassPriceOverride,
  type WeightClassPriceOverrides,
} from "@/lib/content/websiteWeightClassPrices";
import {
  roundToNearest5,
  websiteSeedCustomerPrice,
  WHITE_GOODS_ORDER_LEVEL_EXTRAS,
  type WhiteGoodsProductSeed,
} from "@/lib/content/whiteGoodsElectronics";
import { buildDeliveryTypesJson, mergePreservedDeliveryTypes } from "@/lib/content/websiteDeliveryTypes";
import { shortenCatalogCode } from "@/lib/content/shortCatalogCode";

function buildPriceListSettings(deliveryOnly: boolean, weightClassPrices: WeightClassPriceOverrides = {}) {
  const extras = WHITE_GOODS_ORDER_LEVEL_EXTRAS;
  const settings = createDefaultPriceListSettings();
  settings.deliveryOnly = deliveryOnly;
  const setting = (
    extra: { code: string; customerPrice: number; subcontractorPrice: number },
    description: string,
  ) => ({
    code: extra.code,
    description,
    price: String(websiteSeedCustomerPrice(extra.customerPrice)),
    subcontractorPrice: String(roundToNearest5(extra.subcontractorPrice)),
  });

  settings.extraPickup = setting(extras.extraPickup, "Additional pickup / pickup in another store");
  settings.expressDelivery = setting(extras.expressDelivery, "Express delivery under 24h");
  settings.kmFrom21 = setting(extras.kmFrom21, "Per km when distance is over 20 km");
  settings.kmOver100 = setting(extras.kmOver100, "Per km when distance is over 100 km");
  settings.floorSurcharge = setting(extras.floorSurcharge, "Floor surcharge per chargeable floor, no lift");

  // Floor surcharge and return by weight class (websiteWeightClassPrices.ts):
  // customer prices cleaned like every website price, partner at today's share.
  const weightClassPricing = createDefaultWeightClassPricing();
  for (const weightClass of WEIGHT_CLASSES) {
    const priced = (charge: { code: string; description: string }, price: WeightClassPriceOverride, partnerShare: number) => {
      const { customerPrice, subcontractorPrice } =
        typeof price === "number" ? { customerPrice: price, subcontractorPrice: price * partnerShare } : price;
      return {
        ...charge,
        price: String(websiteSeedCustomerPrice(customerPrice)),
        subcontractorPrice: String(roundToNearest5(subcontractorPrice)),
      };
    };
    weightClassPricing.floorSurcharge[weightClass] = priced(
      weightClassPricing.floorSurcharge[weightClass],
      weightClassPrices.floorSurcharge?.[weightClass] ?? WEIGHT_CLASS_FLOOR_SURCHARGE[weightClass],
      FLOOR_SURCHARGE_PARTNER_SHARE,
    );
    weightClassPricing.returnPrice[weightClass] = priced(
      weightClassPricing.returnPrice[weightClass],
      weightClassPrices.returnPrice?.[weightClass] ?? WEIGHT_CLASS_RETURN_PRICE[weightClass],
      RETURN_PARTNER_SHARE,
    );
  }
  settings.weightClassPricing = weightClassPricing;
  return settings;
}

// Option codes were shortened (shortCatalogCode.ts). An option still stored
// under its old long code is renamed in place before the upsert, so the upsert
// updates that same row: its id, its prices and every order pointing at it
// stay, and no duplicate appears next to it. Skipped when the short code
// already exists, so two rows never share a code.
async function renameLongOptionCodes(productId: string, seedCodes: string[]) {
  const wanted = new Set(seedCodes);
  const existing = await prisma.productOption.findMany({ where: { productId }, select: { id: true, code: true } });
  const taken = new Set(existing.map((o) => o.code));
  for (const option of existing) {
    const short = shortenCatalogCode(option.code);
    if (short === option.code || !wanted.has(short) || taken.has(short)) continue;
    await prisma.productOption.update({ where: { id: option.id }, data: { code: short } });
    taken.add(short);
  }
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
  retireMissingOptionsWithPrefix,
  weightClassPrices,
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
  // Options with this code prefix that are no longer in a product's seed are
  // deactivated (not deleted — saved orders still point at them). Furniture
  // uses it for the per-type dismantling options the shared four replaced.
  retireMissingOptionsWithPrefix?: string;
  // This list's own weight class prices over the table's (white goods' light).
  weightClassPrices?: WeightClassPriceOverrides;
}) {
  const description = serializePriceListSettings(buildPriceListSettings(deliveryOnly, weightClassPrices));

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
      // Only when the seed has one: a class staff set on a product the seed
      // doesn't class is left alone.
      ...(productSeed.weightClass ? { weightClass: productSeed.weightClass } : {}),
      deliveryTypes,
    };

    // deliveryTypes carries prices (per-product, JSON — see
    // Product.deliveryTypes), same as PriceListItem does for options below.
    // A delivery-only product (no options — e.g. parcel/pallet) has NO
    // PriceListItem rows at all, so this is the only place its price lives.
    // When preserving, staff-entered prices here are kept just like
    // PriceListItem prices are, but a delivery type still at the 0 kr
    // placeholder gets the seed's price (mergePreservedDeliveryTypes).
    const stored = preservePricesOnReseed
      ? await prisma.product.findUnique({ where: { code: productSeed.code }, select: { deliveryTypes: true } })
      : null;
    const product = await prisma.product.upsert({
      where: { code: productSeed.code },
      update: stored ? { ...productData, deliveryTypes: mergePreservedDeliveryTypes(stored.deliveryTypes, deliveryTypes) } : productData,
      create: { ...productData, code: productSeed.code },
    });
    productsUpserted += 1;

    // Delivery prices are per price list since PriceListProductConfig
    // (lib/products/productConfig.ts): the catalog reads this list's own row
    // first and only falls back to Product.deliveryTypes, and the migration
    // that added it gave every existing list a copy. So the seed's prices must
    // land on this row too, or a reseed changes nothing. When preserving, the
    // row's own (staff-edited) prices are what's kept.
    const configKey = { priceListId_productId: { priceListId: priceList.id, productId: product.id } };
    const storedConfig = preservePricesOnReseed
      ? await prisma.priceListProductConfig.findUnique({ where: configKey, select: { deliveryTypes: true } })
      : null;
    const configDeliveryTypes = preservePricesOnReseed
      ? mergePreservedDeliveryTypes(storedConfig?.deliveryTypes ?? stored?.deliveryTypes, deliveryTypes)
      : deliveryTypes;
    await prisma.priceListProductConfig.upsert({
      where: configKey,
      update: { deliveryTypes: configDeliveryTypes },
      create: { priceListId: priceList.id, productId: product.id, deliveryTypes: configDeliveryTypes },
    });

    // With no options there's no PriceListItem to tie the product to this
    // list, so link it explicitly (the editor lists it from this link).
    if (productSeed.options.length === 0) {
      await prisma.priceListProduct.upsert({
        where: { priceListId_productId: { priceListId: priceList.id, productId: product.id } },
        update: {},
        create: { priceListId: priceList.id, productId: product.id },
      });
    }

    await renameLongOptionCodes(product.id, productSeed.options.map((o) => o.code));

    for (const [index, optionSeed] of productSeed.options.entries()) {
      const optionData = {
        label: optionSeed.labelEn,
        description: optionSeed.labelNo,
        descriptionEn: optionSeed.labelEn,
        category: optionSeed.category,
        sortOrder: index + 1,
        ...(optionSeed.weightClass ? { weightClass: optionSeed.weightClass } : {}),
      };

      const option = await prisma.productOption.upsert({
        where: {
          productId_code: { productId: product.id, code: optionSeed.code },
        },
        update: optionData,
        create: { ...optionData, productId: product.id, code: optionSeed.code },
      });

      const prices = {
        customerPriceCents: Math.round(
          (optionSeed.exactCustomerPrice ? optionSeed.customerPrice : websiteSeedCustomerPrice(optionSeed.customerPrice)) * 100,
        ),
        subcontractorPriceCents: Math.round(roundToNearest5(optionSeed.subcontractorPrice) * 100),
      };

      const where = { priceListId_productOptionId: { priceListId: priceList.id, productOptionId: option.id } };
      // Preserved prices are kept, except one still at the 0 kr placeholder.
      let update: typeof prices | Record<string, never> = prices;
      if (optionSeed.staffPriced) update = {};
      else if (preservePricesOnReseed) {
        const existing = await prisma.priceListItem.findUnique({
          where,
          select: { customerPriceCents: true, subcontractorPriceCents: true },
        });
        const placeholder = !!existing && !existing.customerPriceCents && !existing.subcontractorPriceCents;
        update = placeholder ? prices : {};
      }
      await prisma.priceListItem.upsert({
        where,
        update,
        create: { ...prices, priceListId: priceList.id, productOptionId: option.id },
      });
      optionsUpserted += 1;
    }

    if (retireMissingOptionsWithPrefix) {
      const kept = productSeed.options.map((o) => o.code).filter((code) => code.startsWith(retireMissingOptionsWithPrefix));
      await prisma.productOption.updateMany({
        where: { productId: product.id, code: { startsWith: retireMissingOptionsWithPrefix, notIn: kept } },
        data: { isActive: false },
      });
    }
  }

  return { priceListId: priceList.id, productsUpserted, optionsUpserted };
}
