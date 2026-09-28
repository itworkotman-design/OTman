import "./_loadLocalSeedEnv";
import { prisma } from "../lib/db";
import { seedWhiteGoodsElectronics } from "../lib/content/seedWhiteGoodsElectronics";

async function main() {
  const result = await seedWhiteGoodsElectronics();
  console.log(
    `White goods catalog seeded: priceListId=${result.priceListId}, products=${result.productsUpserted}, options=${result.optionsUpserted}`,
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
