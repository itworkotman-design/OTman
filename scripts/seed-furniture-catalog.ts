import "./_loadLocalSeedEnv";
import { prisma } from "../lib/db";
import { seedFurnitureCatalog } from "../lib/content/seedFurnitureCatalog";

async function main() {
  const result = await seedFurnitureCatalog();
  console.log(
    `Furniture catalog seeded: priceListId=${result.priceListId}, products=${result.productsUpserted}, options=${result.optionsUpserted}`,
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
