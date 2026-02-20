// lib/getDataset.ts
import { PRODUCTS_DEFAULT } from "@/lib/prices_default/productsDefault";
import { getActiveOptions as getActiveOptionsDefault, getPriceDetails as getPriceDetailsDefault } from "@/lib/prices_default/priceOptionsDefault";
import { PRICE_ITEMS_DEFAULT } from "@/lib/prices_default/pricingDefault";

import { PRODUCTS_POWER } from "@/lib/prices_power/productsPower";
import { getActiveOptions as getActiveOptionsPower, getPriceDetails as getPriceDetailsPower } from "@/lib/prices_power/priceOptionsPower";
import { PRICE_ITEMS_POWER } from "@/lib/prices_power/pricingPower";

export type Dataset = "default" | "power";

export function getDataset(dataset: Dataset) {
  if (dataset === "power") {
    return {
      products: PRODUCTS_POWER,
      priceItems: PRICE_ITEMS_POWER,
      getActiveOptions: getActiveOptionsPower,
      getPriceDetails: getPriceDetailsPower,
    };
  }
  return {
    products: PRODUCTS_DEFAULT,
    priceItems: PRICE_ITEMS_DEFAULT,
    getActiveOptions: getActiveOptionsDefault,
    getPriceDetails: getPriceDetailsDefault,
  };
}