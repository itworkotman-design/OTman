import "dotenv/config";
import { prisma } from "../lib/db";
import { seedMovingCatalog } from "../lib/content/seedMovingCatalog";

async function main() {
  const result = await seedMovingCatalog();
  console.log(
    `Moving catalog seeded: priceListId=${result.priceListId}, productId=${result.productId}, options=${result.optionsUpserted}. ` +
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
