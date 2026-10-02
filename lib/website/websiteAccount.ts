// The dedicated account public website orders/requests are booked under
// (WEBSITE_MEMBERSHIP_ID — read by app/api/site/* and app/api/public/manpower).
// Created by scripts/create-website-account.ts; kept apart from any staff
// login so website orders aren't attributed to a real person.

export const WEBSITE_ACCOUNT_EMAIL = "website@otman.no";
export const WEBSITE_ACCOUNT_COMPANY_SLUG = "otman";

// The slice of the Prisma client this needs — lets the test pass a fake.
export type WebsiteAccountDb = {
  company: {
    findUnique(args: { where: { slug: string }; select: { id: true } }): Promise<{ id: string } | null>;
  };
  user: {
    findUnique(args: { where: { email: string }; select: { id: true } }): Promise<{ id: string } | null>;
    create(args: {
      data: { email: string; passwordHash: string; description: string };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  membership: {
    findUnique(args: {
      where: { userId_companyId: { userId: string; companyId: string } };
      select: { id: true; status: true };
    }): Promise<{ id: string; status: string } | null>;
    create(args: {
      data: { userId: string; companyId: string; role: "USER"; status: "ACTIVE" };
      select: { id: true; status: true };
    }): Promise<{ id: string; status: string }>;
    update(args: {
      where: { id: string };
      data: { status: "ACTIVE" };
      select: { id: true; status: true };
    }): Promise<{ id: string; status: string }>;
  };
};

// Idempotent: reuses the user (never touching its password) and membership
// when they already exist, reactivating the membership if it was disabled.
export async function ensureWebsiteAccount(
  db: WebsiteAccountDb,
  options: { email: string; companySlug: string; passwordHash: string },
): Promise<{ membershipId: string; createdUser: boolean; createdMembership: boolean }> {
  const company = await db.company.findUnique({ where: { slug: options.companySlug }, select: { id: true } });
  if (!company) throw new Error(`Company with slug '${options.companySlug}' not found.`);

  let user = await db.user.findUnique({ where: { email: options.email }, select: { id: true } });
  const createdUser = !user;
  if (!user) {
    user = await db.user.create({
      data: {
        email: options.email,
        passwordHash: options.passwordHash,
        description: "Website account — public website orders and requests are booked under this login.",
      },
      select: { id: true },
    });
  }

  const select = { id: true, status: true } as const;
  let membership = await db.membership.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    select,
  });
  const createdMembership = !membership;
  if (!membership) {
    membership = await db.membership.create({
      data: { userId: user.id, companyId: company.id, role: "USER", status: "ACTIVE" },
      select,
    });
  } else if (membership.status !== "ACTIVE") {
    membership = await db.membership.update({ where: { id: membership.id }, data: { status: "ACTIVE" }, select });
  }

  return { membershipId: membership.id, createdUser, createdMembership };
}
