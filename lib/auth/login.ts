import { AuthEventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { createSession } from "@/lib/auth/createSession";
import {
  hashPassword,
  verifyPasswordWithMetadata,
} from "@/lib/auth/password";
import {
  checkRateLimit,
  clearRateLimit,
  incrementRateLimit,
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  LOGIN_WINDOW_MS,
} from "@/lib/auth/rateLimit";

type LoginResult =
  | {
      ok: true;
      userId: string;
      sessionToken: string;
      sessionExpiresAt: Date;
      activeCompanyId: string | null;
    }
  | {
      ok: false;
      reason: "INVALID_CREDENTIALS" | "USER_DISABLED" | "RATE_LIMITED";
    };

async function incrementLoginRateLimits(
  identifierKey: string,
  ipKey: string | null
): Promise<void> {
  await incrementRateLimit({
    key: identifierKey,
    windowMs: LOGIN_WINDOW_MS,
  });

  if (ipKey) {
    await incrementRateLimit({
      key: ipKey,
      windowMs: LOGIN_WINDOW_MS,
    });
  }
}

type LoginIdentifier =
  | { kind: "email"; value: string }
  | { kind: "username"; value: string };

function normalizeLoginIdentifier(rawIdentifier: string): LoginIdentifier | null {
  const trimmed = rawIdentifier.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("@")) {
    return {
      kind: "email",
      value: trimmed.toLowerCase(),
    };
  }

  return {
    kind: "username",
    value: trimmed.toLowerCase(),
  };
}

export async function loginWithIdentifierPassword(params: {
  identifier: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<LoginResult> {
  const normalizedIdentifier = normalizeLoginIdentifier(params.identifier);
  const password = params.password;

  if (!normalizedIdentifier || !password) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  const identifierKey = `login:${normalizedIdentifier.kind}:${normalizedIdentifier.value}`;
  const ipKey = params.ip ? `login:ip:${params.ip}` : null;

  const identifierCheck = await checkRateLimit({
    key: identifierKey,
    limit: LOGIN_EMAIL_LIMIT,
  });

  if (!identifierCheck.allowed) {
    return { ok: false, reason: "RATE_LIMITED" };
  }

  if (ipKey) {
    const ipCheck = await checkRateLimit({
      key: ipKey,
      limit: LOGIN_IP_LIMIT,
    });

    if (!ipCheck.allowed) {
      return { ok: false, reason: "RATE_LIMITED" };
    }
  }

  const user =
    normalizedIdentifier.kind === "email"
      ? await prisma.user.findUnique({
          where: { email: normalizedIdentifier.value },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            status: true,
          },
        })
      : await prisma.user.findFirst({
          where: {
            username: {
              equals: normalizedIdentifier.value,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            status: true,
          },
        });

  if (!user) {
    await logAuthEvent({
      type: AuthEventType.LOGIN_FAIL,
      email:
        normalizedIdentifier.kind === "email"
          ? normalizedIdentifier.value
          : null,
      ip: params.ip,
      userAgent: params.userAgent,
      meta: {
        identifier: normalizedIdentifier.value,
        identifierType: normalizedIdentifier.kind,
      },
    });

    await incrementLoginRateLimits(identifierKey, ipKey);

    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  if (user.status !== "ACTIVE") {
    await logAuthEvent({
      type: AuthEventType.LOGIN_FAIL,
      userId: user.id,
      email: user.email,
      ip: params.ip,
      userAgent: params.userAgent,
      meta: {
        reason: "USER_DISABLED",
        identifier: normalizedIdentifier.value,
        identifierType: normalizedIdentifier.kind,
      },
    });

    await incrementLoginRateLimits(identifierKey, ipKey);

    return { ok: false, reason: "USER_DISABLED" };
  }

  const passwordVerification = await verifyPasswordWithMetadata(
    user.passwordHash,
    password
  );

  if (!passwordVerification.valid) {
    await logAuthEvent({
      type: AuthEventType.LOGIN_FAIL,
      userId: user.id,
      email: user.email,
      ip: params.ip,
      userAgent: params.userAgent,
      meta: {
        reason: "INVALID_PASSWORD",
        identifier: normalizedIdentifier.value,
        identifierType: normalizedIdentifier.kind,
      },
    });

    await incrementLoginRateLimits(identifierKey, ipKey);

    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  if (passwordVerification.needsRehash) {
    const upgradedPasswordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: upgradedPasswordHash },
    });
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      company: {
        status: "ACTIVE",
      },
    },
    select: {
      companyId: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const activeCompanyId =
    memberships.length === 1 ? memberships[0].companyId : null;

  const { sessionToken, sessionExpiresAt } = await createSession({
    userId: user.id,
    activeCompanyId,
    ip: params.ip,
    userAgent: params.userAgent,
  });

  await logAuthEvent({
    type: AuthEventType.LOGIN_SUCCESS,
    userId: user.id,
    companyId: activeCompanyId,
    ip: params.ip,
    userAgent: params.userAgent,
    meta: activeCompanyId ? { autoSelectedTenant: true } : { autoSelectedTenant: false },
  });

  await clearRateLimit(identifierKey);

  return {
    ok: true,
    userId: user.id,
    sessionToken,
    sessionExpiresAt,
    activeCompanyId,
  };
}
