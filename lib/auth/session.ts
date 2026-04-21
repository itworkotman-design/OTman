import { createHash } from "crypto";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "sid";
export const SESSION_DAYS = 30;

function isProd() {
  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(
  res: {
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
  },
  token: string,
  expiresAt: Date
) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(
  res: {
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
  }
) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    expires: new Date(0),
  });
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const hit = parts.find((part) => part.startsWith(`${name}=`));
  if (!hit) return null;
  return decodeURIComponent(hit.slice(name.length + 1));
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export type AuthenticatedSession = {
  sessionId: string;
  userId: string;
  email: string;
  username: string | null;
  logoPath: string | null;
  usernameDisplayColor: string | null;
  userStatus: UserStatus;
  expiresAt: Date;
  activeCompanyId: string | null;
  activeCompanyName: string | null;
  activeCompanySlug: string | null;
};

export async function getAuthenticatedSession(
  req: Request
): Promise<AuthenticatedSession | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const token = parseCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;

  const tokenHash = sha256Hex(token);

  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      activeCompanyId: true,
      activeCompany: {
        select: {
          name: true,
          slug: true,
          status: true,
        },
      },
      user: {
        select: {
          email: true,
          username: true,
          logoPath: true,
          usernameDisplayColor: true,
          status: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.user.status !== "ACTIVE") return null;

  const activeCompany =
    session.activeCompany && session.activeCompany.status === "ACTIVE"
      ? session.activeCompany
      : null;

  prisma.session
    .updateMany({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {});

  return {
    sessionId: session.id,
    userId: session.userId,
    email: session.user.email,
    username: session.user.username,
    logoPath: session.user.logoPath,
    usernameDisplayColor: session.user.usernameDisplayColor,
    userStatus: session.user.status,
    expiresAt: session.expiresAt,
    activeCompanyId: activeCompany ? session.activeCompanyId : null,
    activeCompanyName: activeCompany ? activeCompany.name : null,
    activeCompanySlug: activeCompany ? activeCompany.slug : null,
  };
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  if (!userId) return;

  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
