import "./_loadDevEnv";
import { prisma } from "../lib/db";
import { WEBSITE_ACCOUNT_COMPANY_SLUG, WEBSITE_ACCOUNT_EMAIL } from "../lib/website/websiteAccount";

// One-off lookup: prints the membershipId to use as WEBSITE_MEMBERSHIP_ID —
// the dedicated website account's (see lib/website/websiteAccount.ts). The id
// is a generated cuid that differs per database. Read-only; to create the
// account use `npm run create:website-account`.
async function main() {
  const membership = await prisma.membership.findFirst({
    where: { user: { email: WEBSITE_ACCOUNT_EMAIL }, company: { slug: WEBSITE_ACCOUNT_COMPANY_SLUG } },
    select: { id: true, status: true },
  });

  if (!membership) {
    throw new Error(
      `No membership for ${WEBSITE_ACCOUNT_EMAIL} in company '${WEBSITE_ACCOUNT_COMPANY_SLUG}' — run \`npm run create:website-account\` first.`,
    );
  }

  console.log(`WEBSITE_MEMBERSHIP_ID=${membership.id}  (status: ${membership.status})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
