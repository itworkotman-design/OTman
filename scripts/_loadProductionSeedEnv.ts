import { createInterface } from "readline/promises";
import { config } from "dotenv";
import { assertProductionTarget, describeDatabaseUrl } from "./_seedTarget";

// Side-effect import, must be the FIRST import of a production seed script.
// Reads ONLY .env (the production database) — deliberately never .env.local —
// and refuses to continue if that resolves to a local database.
config({ path: ".env", override: true });

export const productionTarget = describeDatabaseUrl(process.env.DATABASE_URL);
assertProductionTarget(productionTarget);

// Nothing is written until the operator types the database name back. The
// production seed scripts call this before their first query.
export async function confirmProductionSeed(what: string): Promise<void> {
  console.log("");
  console.log("==================== PRODUCTION DATABASE ====================");
  console.log(`  Seeding: ${what}`);
  console.log(`  Target:  ${productionTarget.database} on ${productionTarget.host}`);
  console.log("  Source:  DATABASE_URL from .env");
  console.log("=============================================================");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`Type the database name (${productionTarget.database}) to continue: `)).trim();
    if (answer !== productionTarget.database) {
      console.error("Database name did not match — aborting, nothing was written.");
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}
