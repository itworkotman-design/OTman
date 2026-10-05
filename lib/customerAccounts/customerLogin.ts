import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { checkRateLimit, clearRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";
import { isCustomerAccountExpired, LIFETIME_ORDER_SELECT } from "./accountLifetime";
import { normalizeCustomerEmail } from "./ensureCustomerAccount";
import { generateCustomerPassword } from "./generatedPassword";
import { createCustomerSession, revokeCustomerSessions } from "./customerSession";

// "My order" login and "send me a new password" for temporary customer
// accounts. Both answer the same way for an unknown, expired or wrong
// account, so neither can be used to find out which emails have orders.

const LOGIN_EMAIL_LIMIT = 10;
const LOGIN_IP_LIMIT = 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const RESET_EMAIL_LIMIT = 3;
const RESET_IP_LIMIT = 10;
const RESET_WINDOW_MS = 60 * 60 * 1000;

async function allowed(keys: { key: string; limit: number }[]): Promise<boolean> {
  for (const key of keys) {
    if (!(await checkRateLimit(key)).allowed) return false;
  }
  return true;
}

export type CustomerLoginResult =
  | { ok: true; accountId: string; token: string; expiresAt: Date }
  | { ok: false; reason: "INVALID_CREDENTIALS" | "RATE_LIMITED" };

export async function loginCustomer(params: {
  email: string;
  password: string;
  ip?: string | null;
  now?: Date;
}): Promise<CustomerLoginResult> {
  const email = normalizeCustomerEmail(params.email);
  if (!email || !params.password) return { ok: false, reason: "INVALID_CREDENTIALS" };
  const now = params.now ?? new Date();

  const emailKey = `customer-login:email:${email}`;
  const ipKey = params.ip ? `customer-login:ip:${params.ip}` : null;
  const limits = [{ key: emailKey, limit: LOGIN_EMAIL_LIMIT }, ...(ipKey ? [{ key: ipKey, limit: LOGIN_IP_LIMIT }] : [])];
  if (!(await allowed(limits))) return { ok: false, reason: "RATE_LIMITED" };

  const account = await prisma.customerAccount.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, orders: { select: LIFETIME_ORDER_SELECT } },
  });

  const valid =
    !!account && !isCustomerAccountExpired(account.orders, now) && (await verifyPassword(account.passwordHash, params.password));

  if (!account || !valid) {
    for (const key of [emailKey, ipKey]) {
      if (key) await incrementRateLimit({ key, windowMs: LOGIN_WINDOW_MS });
    }
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  await clearRateLimit(emailKey);
  await prisma.customerAccount.update({ where: { id: account.id }, data: { lastLoginAt: now } });
  const session = await createCustomerSession(account.id);
  return { ok: true, accountId: account.id, token: session.token, expiresAt: session.expiresAt };
}

// The new password for the caller to email (sendCustomerCredentialsEmail),
// logged on the account's newest order — or null, and nothing is sent.
export type CustomerPasswordReset = { accountId: string; email: string; newPassword: string; orderId: string };

export async function resetCustomerPassword(params: {
  email: string;
  ip?: string | null;
  now?: Date;
}): Promise<CustomerPasswordReset | null> {
  const email = normalizeCustomerEmail(params.email);
  if (!email) return null;
  const now = params.now ?? new Date();

  const emailKey = `customer-reset:email:${email}`;
  const ipKey = params.ip ? `customer-reset:ip:${params.ip}` : null;
  const limits = [{ key: emailKey, limit: RESET_EMAIL_LIMIT }, ...(ipKey ? [{ key: ipKey, limit: RESET_IP_LIMIT }] : [])];
  const isAllowed = await allowed(limits);
  for (const key of [emailKey, ipKey]) {
    if (key) await incrementRateLimit({ key, windowMs: RESET_WINDOW_MS });
  }
  if (!isAllowed) return null;

  const account = await prisma.customerAccount.findUnique({
    where: { email },
    select: { id: true, email: true, orders: { select: LIFETIME_ORDER_SELECT } },
  });
  if (!account || account.orders.length === 0 || isCustomerAccountExpired(account.orders, now)) return null;

  const newPassword = generateCustomerPassword();
  await prisma.customerAccount.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeCustomerSessions(account.id);

  const newest = [...account.orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return { accountId: account.id, email: account.email, newPassword, orderId: newest.id };
}
