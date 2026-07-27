import { config } from "dotenv";

// Mirrors Next.js's own precedence (.env.local overrides .env). TypeScript
// hoists all `import` statements above other top-level code when compiling,
// so these calls must live in their own module and be imported first (as a
// side-effecting import) rather than interspersed inline in a script file.
config();
config({ path: ".env.local", override: true });
