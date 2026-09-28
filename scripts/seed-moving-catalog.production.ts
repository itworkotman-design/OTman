// PRODUCTION seed: writes to the database in .env (never .env.local). Local
// seeding is `npm run seed:moving-catalog`; this one is
// `npm run seed:moving-catalog:prod` and asks you to type the database name before
// it writes anything. Deploy the code first — the production database only gets
// the latest migrations when the app is deployed (build.sh runs migrate deploy).
import { confirmProductionSeed } from "./_loadProductionSeedEnv";
import { prisma } from "../lib/db";
import { seedMovingCatalog } from "../lib/content/seedMovingCatalog";

async function main() {
  await confirmProductionSeed("Moving catalog (WEBSITE_MOVING)");

  const result = await seedMovingCatalog();
  console.log(
    `PRODUCTION moving catalog seeded: priceListId=${result.priceListId}, productId=${result.productId}, options=${result.optionsUpserted}`,
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
