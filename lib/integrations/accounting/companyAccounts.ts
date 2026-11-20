import { prisma } from "@/lib/db";
import { hasFullAccess, isOrderCreatorAccess, isSubcontractorAccess } from "@/lib/users/access";
import type { AppPermission, Role } from "@/lib/users/types";

import { membershipUserLabel } from "./accountingOrder";

/** A store or partner account, as the accounting app lists it. */
export type AccountingAccount = { id: string; name: string; active: boolean };

type CompanyMembership = Awaited<ReturnType<typeof loadCompanyMemberships>>[number];

/** Every membership of the company, deactivated ones included: old orders and cases still point at them. */
function loadCompanyMemberships(companyId: string) {
  return prisma.membership.findMany({
    where: { companyId },
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { username: true, email: true, status: true } },
      permissions: { select: { permission: true } },
    },
  });
}

const permissionsOf = (m: CompanyMembership) => m.permissions.map((p) => p.permission) as AppPermission[];

function toAccount(m: CompanyMembership): AccountingAccount {
  return { id: m.id, name: membershipUserLabel(m.user), active: m.status === "ACTIVE" && m.user.status === "ACTIVE" };
}

const byName = (a: AccountingAccount, b: AccountingAccount) => a.name.localeCompare(b.name, "nb");

/** Accounts that book orders (the archive's "Store"): the same rule as the booking form's order creators. */
export async function loadStoreAccounts(companyId: string): Promise<AccountingAccount[]> {
  const memberships = await loadCompanyMemberships(companyId);
  return memberships
    .filter((m) => {
      const permissions = permissionsOf(m);
      if (isSubcontractorAccess(permissions)) return false;
      return hasFullAccess(m.role as Role) || isOrderCreatorAccess(permissions);
    })
    .map(toAccount)
    .sort(byName);
}

/** Partner (subcontractor) accounts: the same rule as the booking form's partner list. */
export async function loadPartnerAccounts(companyId: string): Promise<AccountingAccount[]> {
  const memberships = await loadCompanyMemberships(companyId);
  return memberships
    .filter((m) => m.role === "USER" && isSubcontractorAccess(permissionsOf(m)))
    .map(toAccount)
    .sort(byName);
}
