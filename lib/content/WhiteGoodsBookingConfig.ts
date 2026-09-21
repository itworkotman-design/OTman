import { prisma } from "@/lib/db";

import { WHITE_GOODS_PRICE_LIST_CODE } from "@/lib/content/websitePriceListCodes";

// Looked up by code (WHITE_GOODS_PRICE_LIST_CODE, seeded by
// seedWhiteGoodsElectronics()) rather than a hardcoded id (unlike
// TransportRequestConfig's TRANSPORT_PACKAGE_PRICELIST_ID) since this price
// list's id is only known after seeding runs in a given environment.
export { WHITE_GOODS_PRICE_LIST_CODE };

export async function getWhiteGoodsPriceListId(): Promise<string> {
  const priceList = await prisma.priceList.findUnique({
    where: { code: WHITE_GOODS_PRICE_LIST_CODE },
    select: { id: true },
  });

  if (!priceList) {
    throw new Error(
      `PriceList with code "${WHITE_GOODS_PRICE_LIST_CODE}" not found — run the seed script`,
    );
  }

  return priceList.id;
}
