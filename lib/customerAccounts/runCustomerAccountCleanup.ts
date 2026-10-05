import { prisma } from "@/lib/db";
import { isCustomerAccountExpired, LIFETIME_ORDER_SELECT } from "./accountLifetime";

// The customer-account-cleanup cron: deletes temporary "My order" accounts
// whose orders no longer need them (accountLifetime.ts — all closed for over
// a day, none on hold), and accounts left without orders. Sessions go with
// them (cascade); the orders just lose the link (SetNull) and keep
// everything else.
export async function runCustomerAccountCleanup(params: { now?: Date } = {}) {
  const now = params.now ?? new Date();
  const accounts = await prisma.customerAccount.findMany({ select: { id: true, orders: { select: LIFETIME_ORDER_SELECT } } });

  const due = accounts.filter((account) => isCustomerAccountExpired(account.orders, now)).map((account) => account.id);
  if (due.length === 0) return { checked: accounts.length, deleted: 0 };

  const { count } = await prisma.customerAccount.deleteMany({ where: { id: { in: due } } });
  return { checked: accounts.length, deleted: count };
}
