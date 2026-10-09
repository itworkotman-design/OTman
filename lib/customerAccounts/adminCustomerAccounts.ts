import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createOrderActionEvent, type OrderEventActor } from "@/lib/orders/orderEvents";
import { customerAccountDeleteAt, isCustomerAccountExpired, LIFETIME_ORDER_SELECT } from "./accountLifetime";
import { normalizeCustomerEmail } from "./ensureCustomerAccount";
import { generateCustomerPassword } from "./generatedPassword";
import { revokeCustomerSessions } from "./customerSession";
import { sendCustomerCredentialsEmail } from "./customerCredentialsEmail";

// The "Website users" tab in user management: the temporary "My order"
// logins of a company's homepage customers, and what staff can do with them.
// An account belongs to no company itself (one email, one login) — it is the
// company's when it has orders there. One that also has another company's
// orders is listed but can't be changed, so one company can never take over
// another's customer.

export const MIN_CUSTOMER_PASSWORD_LENGTH = 8;

const ACCOUNT_SELECT = (now: Date) =>
  ({
    id: true,
    email: true,
    createdAt: true,
    lastLoginAt: true,
    sessions: { where: { revokedAt: null, expiresAt: { gt: now } }, select: { id: true } },
    orders: {
      select: {
        ...LIFETIME_ORDER_SELECT,
        companyId: true,
        orderNumber: true,
        displayId: true,
        deliveryDate: true,
        customerName: true,
        emailThreadToken: true,
      },
    },
  }) as const;

type AccountRow = Prisma.CustomerAccountGetPayload<{ select: ReturnType<typeof ACCOUNT_SELECT> }>;
export type ManagedCustomerAccount = AccountRow;

export type CompanyCustomerAccount = {
  id: string;
  email: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  activeSessions: number;
  // When the cleanup cron deletes it; null = kept while an order is open.
  deleteAt: Date | null;
  sharedWithOtherCompany: boolean;
  orders: { id: string; orderNumber: string | null; displayId: number | null; status: string | null; deliveryDate: string | null }[];
};

export async function listCompanyCustomerAccounts(companyId: string, now: Date = new Date()): Promise<CompanyCustomerAccount[]> {
  const accounts = await prisma.customerAccount.findMany({
    where: { orders: { some: { companyId } } },
    orderBy: { createdAt: "desc" },
    select: ACCOUNT_SELECT(now),
  });
  return accounts
    .filter((account) => !isCustomerAccountExpired(account.orders, now))
    .map((account) => ({
      id: account.id,
      email: account.email,
      createdAt: account.createdAt,
      lastLoginAt: account.lastLoginAt,
      activeSessions: account.sessions.length,
      deleteAt: customerAccountDeleteAt(account.orders, undefined, now),
      sharedWithOtherCompany: account.orders.some((order) => order.companyId !== companyId),
      orders: account.orders
        .filter((order) => order.companyId === companyId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          displayId: order.displayId,
          status: order.status,
          deliveryDate: order.deliveryDate,
        })),
    }));
}

export async function findManageableCustomerAccount(
  companyId: string,
  accountId: string,
): Promise<{ ok: true; account: ManagedCustomerAccount } | { ok: false; reason: "NOT_FOUND" | "SHARED_ACCOUNT" }> {
  const account = await prisma.customerAccount.findUnique({ where: { id: accountId }, select: ACCOUNT_SELECT(new Date()) });
  if (!account || !account.orders.some((order) => order.companyId === companyId)) return { ok: false, reason: "NOT_FOUND" };
  if (account.orders.some((order) => order.companyId !== companyId)) return { ok: false, reason: "SHARED_ACCOUNT" };
  return { ok: true, account };
}

// Every change is on the record of each of the customer's orders.
async function logOnOrders(account: ManagedCustomerAccount, actor: OrderEventActor, title: string, details: string[] = []) {
  for (const order of account.orders) {
    await createOrderActionEvent(prisma, { orderId: order.id, companyId: order.companyId, actor, title, details });
  }
}

export async function setCustomerAccountPassword(params: {
  account: ManagedCustomerAccount;
  password: string;
  actor: OrderEventActor;
}): Promise<{ ok: true } | { ok: false; reason: "PASSWORD_TOO_SHORT" }> {
  if (params.password.length < MIN_CUSTOMER_PASSWORD_LENGTH) return { ok: false, reason: "PASSWORD_TOO_SHORT" };
  await prisma.customerAccount.update({ where: { id: params.account.id }, data: { passwordHash: await hashPassword(params.password) } });
  await revokeCustomerSessions(params.account.id);
  await logOnOrders(params.account, params.actor, "Staff set a new My order password", [`Login: ${params.account.email}`]);
  return { ok: true };
}

// A generated password, emailed (on the newest order) like "Send new login".
export async function sendNewCustomerPassword(params: {
  account: ManagedCustomerAccount;
  actor: OrderEventActor;
}): Promise<{ ok: true } | { ok: false; reason: "EMAIL_FAILED" }> {
  const { account } = params;
  const password = generateCustomerPassword();
  await prisma.customerAccount.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(password) } });
  await revokeCustomerSessions(account.id);
  await logOnOrders(account, params.actor, "Sent the customer a new My order login", [`Recipient: ${account.email}`]);

  const newest = [...account.orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const sent = await sendCustomerCredentialsEmail({
    order: {
      id: newest.id,
      companyId: newest.companyId,
      displayId: newest.displayId,
      orderNumber: newest.orderNumber,
      customerName: newest.customerName,
      emailThreadToken: newest.emailThreadToken,
    },
    email: account.email,
    password,
  });
  return sent ? { ok: true } : { ok: false, reason: "EMAIL_FAILED" };
}

// The login email, and the email on the customer's orders here, so order
// emails go to the same address.
export async function changeCustomerAccountEmail(params: {
  account: ManagedCustomerAccount;
  companyId: string;
  email: string;
  actor: OrderEventActor;
}): Promise<{ ok: true; email: string } | { ok: false; reason: "INVALID_EMAIL" | "EMAIL_TAKEN" }> {
  const email = normalizeCustomerEmail(params.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "INVALID_EMAIL" };
  if (email === params.account.email) return { ok: true, email };

  const taken = await prisma.customerAccount.findUnique({ where: { email }, select: { id: true } });
  if (taken) return { ok: false, reason: "EMAIL_TAKEN" };
  try {
    await prisma.customerAccount.update({ where: { id: params.account.id }, data: { email } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, reason: "EMAIL_TAKEN" };
    throw error;
  }
  await prisma.order.updateMany({ where: { customerAccountId: params.account.id, companyId: params.companyId }, data: { email } });
  await logOnOrders(params.account, params.actor, "Staff changed the My order login email", [`From: ${params.account.email}`, `To: ${email}`]);
  return { ok: true, email };
}

export async function signOutCustomerAccount(params: { account: ManagedCustomerAccount; actor: OrderEventActor }) {
  await revokeCustomerSessions(params.account.id);
  await logOnOrders(params.account, params.actor, "Staff signed the customer out of My order");
}

// The orders stay; they just lose the login (SetNull), like the cleanup cron.
export async function deleteCustomerAccount(params: { account: ManagedCustomerAccount; actor: OrderEventActor }) {
  await logOnOrders(params.account, params.actor, "Staff deleted the My order login", [`Login: ${params.account.email}`]);
  await prisma.customerAccount.delete({ where: { id: params.account.id } });
}
