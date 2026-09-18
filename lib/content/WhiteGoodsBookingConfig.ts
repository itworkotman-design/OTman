import { prisma } from "@/lib/db";

// Matches the PriceList.code seeded in prisma/seed.ts's
// seedWhiteGoodsElectronics(). Looked up by code rather than a hardcoded id
// (unlike TransportRequestConfig's TRANSPORT_PACKAGE_PRICELIST_ID) since this
// price list's id is only known after seeding runs in a given environment.
export const WHITE_GOODS_PRICE_LIST_CODE = "WEBSITE_WHITE_GOODS";

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
