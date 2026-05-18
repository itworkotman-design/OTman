import "dotenv/config";
import { prisma } from "../lib/db";
import {
  parseWordpressImportCliArgs,
  runWordpressOrderImport,
} from "../lib/integrations/wordpress/orderImport";

async function main() {
  const options = parseWordpressImportCliArgs(process.argv.slice(2));

  console.log("WordPress historical order import starting", options);
  const summary = await runWordpressOrderImport(options);

  console.log("WordPress historical order import complete", summary);
  if (summary.failed > 0) {
    console.error("WordPress historical order import failed IDs", summary.failures);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("WordPress historical order import crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
