import "./_loadLocalSeedEnv";
import { prisma } from "../lib/db";
import { seedParcelPalletCatalog } from "../lib/content/seedParcelPalletCatalog";

async function main() {
  const result = await seedParcelPalletCatalog();
  console.log(
    `Parcel/pallet catalog seeded: priceListId=${result.priceListId}, products=${result.productsUpserted}, options=${result.optionsUpserted}. ` +
      `Prices default to 0 kr — set real prices via /dashboard/booking/editPrices before this goes live.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
