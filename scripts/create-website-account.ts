import "./_loadDevEnv";
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth/password";
import {
  WEBSITE_ACCOUNT_COMPANY_SLUG,
  WEBSITE_ACCOUNT_EMAIL,
  ensureWebsiteAccount,
} from "../lib/website/websiteAccount";

// Creates (or reuses) the dedicated website account and prints the
// WEBSITE_MEMBERSHIP_ID to configure. A new user gets a random password
// nobody knows — set a real one via forgot-password / user management if
// anyone needs to log in as it. Runs against DATABASE_URL (.env.local wins).
async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@([^/:]+).*$/, "$1");
  console.log(`Database host: ${host}`);

  const result = await ensureWebsiteAccount(prisma, {
    email: WEBSITE_ACCOUNT_EMAIL,
    companySlug: WEBSITE_ACCOUNT_COMPANY_SLUG,
    passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
  });

  console.log(
    `${result.createdUser ? "Created" : "Reused"} user ${WEBSITE_ACCOUNT_EMAIL}; ` +
      `${result.createdMembership ? "created" : "reused"} membership in '${WEBSITE_ACCOUNT_COMPANY_SLUG}'.`,
  );
  console.log(`WEBSITE_MEMBERSHIP_ID=${result.membershipId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
