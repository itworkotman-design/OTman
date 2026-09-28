// PRODUCTION seed: writes to the database in .env (never .env.local). Local
// seeding is `npm run seed:white-goods-catalog`; this one is
// `npm run seed:white-goods-catalog:prod` and asks you to type the database name before
// it writes anything. Deploy the code first — the production database only gets
// the latest migrations when the app is deployed (build.sh runs migrate deploy).
import { confirmProductionSeed } from "./_loadProductionSeedEnv";
import { prisma } from "../lib/db";
import { seedWhiteGoodsElectronics } from "../lib/content/seedWhiteGoodsElectronics";

async function main() {
  await confirmProductionSeed("White goods & electronics catalog");

  const result = await seedWhiteGoodsElectronics();
  console.log(
    `PRODUCTION white goods catalog seeded: priceListId=${result.priceListId}, products=${result.productsUpserted}, options=${result.optionsUpserted}`,
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
