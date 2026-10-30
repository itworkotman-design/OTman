import { prisma } from "@/lib/db";

// One specific user (a "store" in the order-list sense) handles every
// insurance case. The Insurance cases dashboard page is the main order list
// locked to that store's membership — configured per environment via
// INSURANCE_CASES_USER_EMAIL rather than stored in the DB.

export type InsuranceCasesStore =
  | { ok: true; membershipId: string; label: string }
  | { ok: false; reason: "NOT_CONFIGURED" }
  | { ok: false; reason: "USER_NOT_FOUND"; email: string };

export function getInsuranceCasesUserEmail(): string | null {
  const email = process.env.INSURANCE_CASES_USER_EMAIL?.trim().toLowerCase();
  return email ? email : null;
}

export async function getInsuranceCasesStore(companyId: string): Promise<InsuranceCasesStore> {
  const email = getInsuranceCasesUserEmail();
  if (!email) return { ok: false, reason: "NOT_CONFIGURED" };

  const membership = await prisma.membership.findFirst({
    where: {
      companyId,
      status: "ACTIVE",
      user: { email: { equals: email, mode: "insensitive" } },
    },
    select: {
      id: true,
      user: { select: { email: true, username: true } },
    },
  });

  if (!membership) return { ok: false, reason: "USER_NOT_FOUND", email };

  return {
    ok: true,
    membershipId: membership.id,
    label: membership.user.username || membership.user.email,
  };
}
