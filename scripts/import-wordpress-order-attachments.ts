import "dotenv/config";
import { prisma } from "../lib/db";
import {
  parseWordpressImportCliArgs,
  runWordpressAttachmentImport,
} from "../lib/integrations/wordpress/orderImport";

async function main() {
  const options = parseWordpressImportCliArgs(process.argv.slice(2));

  console.log("WordPress historical attachment import starting", options);
  const summary = await runWordpressAttachmentImport(options);

  console.log("WordPress historical attachment import complete", summary);
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("WordPress historical attachment import crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
