import { config } from "dotenv";

// Like _loadDevEnv, but `--prod` skips the .env.local override so the script
// runs against .env (production). Must be imported first, as a
// side-effecting import, for the same hoisting reason as _loadDevEnv.
config();
if (!process.argv.includes("--prod")) {
  config({ path: ".env.local", override: true });
}
