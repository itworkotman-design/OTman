import { prisma } from "../lib/db";

// One-off lookup: prints the membershipId to use as WEBSITE_MEMBERSHIP_ID for
// a freshly seeded environment (prisma/seed.ts creates this user/company
// deterministically by email/slug, but the membership id itself is a
// generated cuid that differs per database).
async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "itworkotman@gmail.com" },
    select: { id: true },
  });

  if (!user) {
    throw new Error(
      "User itworkotman@gmail.com not found — run `npx tsx prisma/seed.ts` against this database first.",
    );
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, company: { slug: "otman" } },
    select: { id: true, status: true },
  });

  if (!membership) {
    throw new Error("Membership not found for itworkotman@gmail.com in company 'otman'.");
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
