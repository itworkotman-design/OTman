import { config } from "dotenv";
import { assertLocalTarget, describeDatabaseUrl } from "./_seedTarget";

// Side-effect import, must be the FIRST import of a local seed script (lib/db
// reads DATABASE_URL when it is imported). Same precedence as Next.js —
// .env.local overrides .env — but then HARD-FAILS unless the resulting database
// is on localhost, so a missing/renamed .env.local can never make a "local"
// seed quietly write to the cloud database that .env points at. (The plain
// `import "dotenv/config"` these scripts used before read only .env.)
config();
config({ path: ".env.local", override: true });

const target = describeDatabaseUrl(process.env.DATABASE_URL);
assertLocalTarget(target, "this seed script");

console.log(`Seeding LOCAL database "${target.database}" on ${target.host}`);
