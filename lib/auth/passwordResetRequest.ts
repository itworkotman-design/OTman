import { prisma } from "@/lib/db";
import { logAuthEvent } from "@/lib/auth/authEvent";
import {
    checkRateLimit,
    incrementRateLimit,
    PASSWORD_RESET_EMAIL_LIMIT,
    PASSWORD_RESET_IP_LIMIT,
    PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    PASSWORD_RESET_TOKEN_TTL_MS,
} from "@/lib/auth/rateLimit";
import {
    generatePasswordResetToken,
    hashPasswordResetToken,
} from "@/lib/auth/passwordResetToken";
import { AuthEventType } from "@prisma/client";
import { deliverPasswordReset } from "@/lib/auth/passwordResetDelivery";

type RequestPasswordResetResult =
    | { ok: true }
    | { ok: false; reason: "RATE_LIMITED" };

async function incrementPasswordResetRateLimits(
    emailKey: string,
    ipKey: string | null
): Promise<void> {
    await incrementRateLimit({
        key: emailKey,
        windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    });

    if (ipKey) {
        await incrementRateLimit({
            key: ipKey,
            windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
        });
    }
}

export async function requestPasswordReset(params: {
    email: string;
    ip?: string | null;
    userAgent?: string | null;
}): Promise<RequestPasswordResetResult> {
    const email = params.email.trim().toLowerCase();

    const emailKey = `password-reset:email:${email}`;
    const ipKey = params.ip ? `password-reset:ip:${params.ip}` : null;

    const emailCheck = await checkRateLimit({
        key: emailKey,
        limit: PASSWORD_RESET_EMAIL_LIMIT,
    });

    if (!emailCheck.allowed) {
        return { ok: false, reason: "RATE_LIMITED" };
    }

    if (ipKey) {
        const ipCheck = await checkRateLimit({
            key: ipKey,
            limit: PASSWORD_RESET_IP_LIMIT,
        });

        if (!ipCheck.allowed) {
            return { ok: false, reason: "RATE_LIMITED" };
        }
    }

    if (!email) {
        await incrementPasswordResetRateLimits(emailKey, ipKey);
        return { ok: true };
    }

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, status: true },
    });

    await incrementPasswordResetRateLimits(emailKey, ipKey);

    if (!user || user.status !== "ACTIVE") {
        return { ok: true };
    }

    const token = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.updateMany({
            where: {
                userId: user.id,
                usedAt: null,
            },
            data: {
                usedAt: new Date(),
            },
        });

        await tx.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            },
        });
    });

    await deliverPasswordReset({
        email,
        token,
    });

    await logAuthEvent({
        type: AuthEventType.PASSWORD_RESET_REQUEST,
        userId: user.id,
        email,
        ip: params.ip,
        userAgent: params.userAgent,
    });

    return { ok: true };
}
