import { prisma } from "@/lib/db";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/sessionToken";
import { isCustomerAccountExpired, LIFETIME_ORDER_SELECT } from "./accountLifetime";

// The "My order" login session for a temporary customer account. Its own
// cookie and table — never the dashboard's `sid`/Session, so a customer
// session can't reach anything behind dashboard auth.
export const CUSTOMER_SESSION_COOKIE = "csid";
export const CUSTOMER_SESSION_DAYS = 7;

type CookieResponse = {
  cookies: {
    set: (options: {
      name: string;
      value: string;
      httpOnly: boolean;
      sameSite: "lax" | "strict" | "none";
      secure: boolean;
      path: string;
      expires: Date;
    }) => void;
  };
};

export function setCustomerSessionCookie(res: CookieResponse, token: string, expiresAt: Date) {
  res.cookies.set({
    name: CUSTOMER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearCustomerSessionCookie(res: CookieResponse) {
  setCustomerSessionCookie(res, "", new Date(0));
}

export async function createCustomerSession(customerAccountId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.customerSession.create({
    data: { customerAccountId, tokenHash: hashSessionToken(token), expiresAt },
  });
  return { token, expiresAt };
}

function readCookie(cookieHeader: string, name: string): string | null {
  const hit = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

export type CustomerSession = { sessionId: string; accountId: string; email: string };

// From a request's cookie header (API routes) or a raw token (server pages,
// via next/headers cookies()).
export async function getCustomerSessionFromToken(token: string | null | undefined): Promise<CustomerSession | null> {
  if (!token) return null;
  const now = new Date();
  const session = await prisma.customerSession.findFirst({
    where: { tokenHash: hashSessionToken(token), revokedAt: null, expiresAt: { gt: now } },
    select: {
      id: true,
      customerAccount: { select: { id: true, email: true, orders: { select: LIFETIME_ORDER_SELECT } } },
    },
  });
  if (!session) return null;
  // Past its delete time but not yet removed by the cron: already gone.
  if (isCustomerAccountExpired(session.customerAccount.orders, now)) return null;

  prisma.customerSession.updateMany({ where: { id: session.id }, data: { lastSeenAt: now } }).catch(() => {});

  return { sessionId: session.id, accountId: session.customerAccount.id, email: session.customerAccount.email };
}

export async function getCustomerSession(req: Request): Promise<CustomerSession | null> {
  const cookieHeader = req.headers.get("cookie");
  return getCustomerSessionFromToken(cookieHeader ? readCookie(cookieHeader, CUSTOMER_SESSION_COOKIE) : null);
}

export async function revokeCustomerSession(sessionId: string): Promise<void> {
  await prisma.customerSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

// Every session of the account, except `exceptSessionId` (the one changing
// the password keeps working).
export async function revokeCustomerSessions(customerAccountId: string, exceptSessionId?: string): Promise<void> {
  await prisma.customerSession.updateMany({
    where: { customerAccountId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}
