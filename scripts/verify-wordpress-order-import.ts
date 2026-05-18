import "dotenv/config";
import { prisma } from "../lib/db";
import { verifyWordpressOrderImport } from "../lib/integrations/wordpress/orderImport";

async function main() {
  const result = await verifyWordpressOrderImport();

  console.log("WordPress historical order import verification", result);
  if (result.wordpressTotal !== null && result.wordpressTotal !== result.importedTotal) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("WordPress historical order import verification crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
