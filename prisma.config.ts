import { config as loadEnv } from "dotenv";

// Mirrors Next.js's own precedence (.env.local overrides .env) — dotenv
// never overwrites a key that's already set, so loading .env.local first
// makes it win.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const config = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
};

export default config;
