import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { isCustomerAccountExpired, LIFETIME_ORDER_SELECT } from "./accountLifetime";
import { generateCustomerPassword } from "./generatedPassword";

// Links a homepage order to its customer's temporary account (by email),
// creating the account when there is none. Called by the homepage order
// routes right after the order is saved, and by staff "Send new login".
//
// `newPassword` is the plaintext password only when one was just set — the
// caller emails it (sendCustomerCredentialsEmail) and it is never stored. A
// returning customer whose account is still live keeps their password, so a
// second order doesn't sign them out of the first.
export type EnsuredCustomerAccount = { accountId: string; email: string; newPassword: string | null };

export function normalizeCustomerEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase() ?? "";
  return value.includes("@") ? value : null;
}

async function findAccount(email: string) {
  return prisma.customerAccount.findUnique({
    where: { email },
    select: { id: true, orders: { select: LIFETIME_ORDER_SELECT } },
  });
}

export async function ensureCustomerAccountForOrder(params: {
  orderId: string;
  email: string | null | undefined;
  forceNewPassword?: boolean;
  now?: Date;
}): Promise<EnsuredCustomerAccount | null> {
  const email = normalizeCustomerEmail(params.email);
  if (!email) return null;
  const now = params.now ?? new Date();

  let account = await findAccount(email);

  if (!account) {
    const newPassword = generateCustomerPassword();
    const passwordHash = await hashPassword(newPassword);
    try {
      const created = await prisma.customerAccount.create({ data: { email, passwordHash }, select: { id: true } });
      await linkOrder(params.orderId, created.id);
      return { accountId: created.id, email, newPassword };
    } catch (error) {
      // Another order for the same email created it a moment ago.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      account = await findAccount(email);
      if (!account) throw error;
    }
  }

  // Whether anything other than this order keeps the account alive — an
  // account past its delete time (cron not run yet) starts over with a new
  // password, the old one is as good as gone.
  const otherOrders = account.orders.filter((order) => order.id !== params.orderId);
  const needsPassword = params.forceNewPassword === true || isCustomerAccountExpired(otherOrders, now);

  let newPassword: string | null = null;
  if (needsPassword) {
    newPassword = generateCustomerPassword();
    await prisma.customerAccount.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(newPassword) } });
    await prisma.customerSession.updateMany({
      where: { customerAccountId: account.id, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  await linkOrder(params.orderId, account.id);
  return { accountId: account.id, email, newPassword };
}

async function linkOrder(orderId: string, customerAccountId: string) {
  await prisma.order.update({ where: { id: orderId }, data: { customerAccountId } });
}
