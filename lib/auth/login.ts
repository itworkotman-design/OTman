import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { logAuthEvent } from "@/lib/auth/authEvent";
import { AuthEventType } from "@prisma/client";
import { createSession } from "@/lib/auth/createSession";
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
        sessionToken: string; // plaintext token to set in cookie
        sessionExpiresAt: Date;
    }
    | { ok: false; reason: "INVALID_CREDENTIALS" | "USER_DISABLED" | "RATE_LIMITED" };

async function incrementLoginRateLimits(emailKey: string, ipKey: string | null): Promise<void> {
    await incrementRateLimit({
        key: emailKey,
        windowMs: LOGIN_WINDOW_MS,
    });

    if (ipKey) {
        await incrementRateLimit({
            key: ipKey,
            windowMs: LOGIN_WINDOW_MS,
        });
    }
}

export async function loginWithEmailPassword(params: {
    email: string;
    password: string;
    ip?: string | null;
    userAgent?: string | null;
}): Promise<LoginResult> {
    const email = params.email.trim().toLowerCase();
    const password = params.password;

    if (!email || !password) {
        return { ok: false, reason: "INVALID_CREDENTIALS" };
    }

    const emailKey = `login:email:${email}`;
    const ipKey = params.ip ? `login:ip:${params.ip}` : null;

    const emailCheck = await checkRateLimit({
        key: emailKey,
        limit: LOGIN_EMAIL_LIMIT,
    });

    if (!emailCheck.allowed) {
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

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, passwordHash: true, status: true },
    });

    if (!user) {
        await logAuthEvent({
            type: AuthEventType.LOGIN_FAIL,
            email,
            ip: params.ip,
            userAgent: params.userAgent,
        });

        await incrementLoginRateLimits(emailKey, ipKey);

        return { ok: false, reason: "INVALID_CREDENTIALS" };
    }

    if (user.status !== "ACTIVE") {
        await logAuthEvent({
            type: AuthEventType.LOGIN_FAIL,
            userId: user.id,
            email,
            ip: params.ip,
            userAgent: params.userAgent,
            meta: { reason: "USER_DISABLED" },
        });

        await incrementLoginRateLimits(emailKey, ipKey);

        return { ok: false, reason: "USER_DISABLED" };
    }

    const valid = await verifyPassword(user.passwordHash, password);

    if (!valid) {
        await logAuthEvent({
            type: AuthEventType.LOGIN_FAIL,
            userId: user.id,
            email,
            ip: params.ip,
            userAgent: params.userAgent,
            meta: { reason: "INVALID_PASSWORD" },
        });

        await incrementLoginRateLimits(emailKey, ipKey);

        return { ok: false, reason: "INVALID_CREDENTIALS" };
    }


    const { sessionToken, sessionExpiresAt } = await createSession({
        userId: user.id,
        ip: params.ip,
        userAgent: params.userAgent,
    });

    await logAuthEvent({
        type: AuthEventType.LOGIN_SUCCESS,
        userId: user.id,
        ip: params.ip,
        userAgent: params.userAgent,
    });

    await clearRateLimit(emailKey);

    return { ok: true, userId: user.id, sessionToken, sessionExpiresAt };

}
