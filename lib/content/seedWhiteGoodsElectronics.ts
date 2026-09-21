import { prisma } from "@/lib/db";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import {
  createDefaultPriceListSettings,
  serializePriceListSettings,
} from "@/lib/products/priceListSettings";
import {
  WHITE_GOODS_ELECTRONICS_PRODUCTS,
  roundToNearest5,
  WHITE_GOODS_ORDER_LEVEL_EXTRAS,
  type WhiteGoodsProductSeed,
} from "@/lib/content/whiteGoodsElectronics";
import { WHITE_GOODS_PRICE_LIST_CODE } from "@/lib/content/WhiteGoodsBookingConfig";

function buildWhiteGoodsDeliveryTypesJson(product: WhiteGoodsProductSeed) {
  const { firstStep, indoor, installOnlyEnabled } = product.deliveryTypes;

  return [
    {
      key: DELIVERY_TYPES.FIRST_STEP,
      enabled: true,
      code: "FIRST_STEP",
      label: "Delivery to doorstep",
      price: String(roundToNearest5(firstStep.customerPrice)),
      subcontractorPrice: String(roundToNearest5(firstStep.subcontractorPrice)),
      xtraPrice: String(roundToNearest5(firstStep.xtraPrice)),
      xtraSubcontractorPrice: String(roundToNearest5(firstStep.xtraSubcontractorPrice)),
      allowInstallOptions: true,
      allowExtraServices: true,
      allowReturnOptions: true,
      allowModelNumber: true,
    },
    {
      key: DELIVERY_TYPES.INDOOR,
      enabled: true,
      code: "INDOOR",
      label: "Delivery with carry-in",
      price: String(roundToNearest5(indoor.customerPrice)),
      subcontractorPrice: String(roundToNearest5(indoor.subcontractorPrice)),
      xtraPrice: String(roundToNearest5(indoor.xtraPrice)),
      xtraSubcontractorPrice: String(roundToNearest5(indoor.xtraSubcontractorPrice)),
      allowInstallOptions: true,
      allowExtraServices: true,
      allowReturnOptions: true,
      allowModelNumber: true,
    },
    {
      key: DELIVERY_TYPES.INSTALL_ONLY,
      enabled: installOnlyEnabled,
      code: "INSTALL_ONLY",
      label: "Installation only",
      price: "0",
      subcontractorPrice: "0",
      xtraPrice: "0",
      xtraSubcontractorPrice: "0",
      allowInstallOptions: true,
      allowExtraServices: true,
      allowReturnOptions: true,
      allowModelNumber: true,
    },
    {
      key: DELIVERY_TYPES.RETURN_ONLY,
      enabled: true,
      code: "RETURN_ONLY",
      label: "Return only",
      price: "0",
      subcontractorPrice: "0",
      xtraPrice: "0",
      xtraSubcontractorPrice: "0",
      allowInstallOptions: false,
      allowExtraServices: false,
      allowReturnOptions: true,
      allowModelNumber: true,
    },
  ];
}

// Seeds the public website's white-goods/electronics delivery+installation
// catalog on its own dedicated PriceList — fully separate from DEFAULT/POWER
// and from the internal dashboard's DISHWASHER/WASHING_MACHINE products, so
// this data never affects pricing for the internal booking flow. Idempotent
// (upsert-based) and side-effect-free beyond this catalog — deliberately
// kept out of prisma/seed.ts's main() (which also resets all company orders)
// so it can be run standalone via `npm run seed:white-goods-catalog`.
export async function seedWhiteGoodsElectronics() {
  const settings = createDefaultPriceListSettings();
  settings.extraPickup = {
    code: WHITE_GOODS_ORDER_LEVEL_EXTRAS.extraPickup.code,
    description: "Additional pickup / pickup in another store",
    price: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.extraPickup.customerPrice)),
    subcontractorPrice: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.extraPickup.subcontractorPrice)),
  };
  settings.expressDelivery = {
    code: WHITE_GOODS_ORDER_LEVEL_EXTRAS.expressDelivery.code,
    description: "Express delivery under 24h",
    price: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.expressDelivery.customerPrice)),
    subcontractorPrice: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.expressDelivery.subcontractorPrice)),
  };
  settings.kmFrom21 = {
    code: WHITE_GOODS_ORDER_LEVEL_EXTRAS.kmFrom21.code,
    description: "Per km when distance is over 20 km",
    price: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.kmFrom21.customerPrice)),
    subcontractorPrice: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.kmFrom21.subcontractorPrice)),
  };
  settings.kmOver100 = {
    code: WHITE_GOODS_ORDER_LEVEL_EXTRAS.kmOver100.code,
    description: "Per km when distance is over 100 km",
    price: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.kmOver100.customerPrice)),
    subcontractorPrice: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.kmOver100.subcontractorPrice)),
  };
  settings.floorSurcharge = {
    code: WHITE_GOODS_ORDER_LEVEL_EXTRAS.floorSurcharge.code,
    description: "Floor surcharge per chargeable floor, no lift",
    price: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.floorSurcharge.customerPrice)),
    subcontractorPrice: String(roundToNearest5(WHITE_GOODS_ORDER_LEVEL_EXTRAS.floorSurcharge.subcontractorPrice)),
  };

  const whiteGoodsList = await prisma.priceList.upsert({
    where: { code: WHITE_GOODS_PRICE_LIST_CODE },
    update: { description: serializePriceListSettings(settings) },
    create: {
      name: "Website — White goods / electronics",
      code: WHITE_GOODS_PRICE_LIST_CODE,
      description: serializePriceListSettings(settings),
    },
  });

  let productsUpserted = 0;
  let optionsUpserted = 0;

  for (const productSeed of WHITE_GOODS_ELECTRONICS_PRODUCTS) {
    const deliveryTypes = buildWhiteGoodsDeliveryTypesJson(productSeed);

    const product = await prisma.product.upsert({
      where: { code: productSeed.code },
      update: {
        name: productSeed.nameEn,
        sortOrder: productSeed.sortOrder,
        productType: "PHYSICAL",
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
      },
      create: {
        name: productSeed.nameEn,
        code: productSeed.code,
        sortOrder: productSeed.sortOrder,
        productType: "PHYSICAL",
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
      },
    });
    productsUpserted += 1;

    for (const [index, optionSeed] of productSeed.options.entries()) {
      const option = await prisma.productOption.upsert({
        where: {
          productId_code: { productId: product.id, code: optionSeed.code },
        },
        update: {
          label: optionSeed.labelEn,
          description: optionSeed.labelNo,
          descriptionEn: optionSeed.labelEn,
          category: optionSeed.category,
          sortOrder: index + 1,
        },
        create: {
          productId: product.id,
          code: optionSeed.code,
          label: optionSeed.labelEn,
          description: optionSeed.labelNo,
          descriptionEn: optionSeed.labelEn,
          category: optionSeed.category,
          sortOrder: index + 1,
        },
      });

      await prisma.priceListItem.upsert({
        where: {
          priceListId_productOptionId: {
            priceListId: whiteGoodsList.id,
            productOptionId: option.id,
          },
        },
        update: {
          customerPriceCents: Math.round(roundToNearest5(optionSeed.customerPrice) * 100),
          subcontractorPriceCents: Math.round(roundToNearest5(optionSeed.subcontractorPrice) * 100),
        },
        create: {
          priceListId: whiteGoodsList.id,
          productOptionId: option.id,
          customerPriceCents: Math.round(roundToNearest5(optionSeed.customerPrice) * 100),
          subcontractorPriceCents: Math.round(roundToNearest5(optionSeed.subcontractorPrice) * 100),
        },
      });
      optionsUpserted += 1;
    }
  }

  return { priceListId: whiteGoodsList.id, productsUpserted, optionsUpserted };
}
